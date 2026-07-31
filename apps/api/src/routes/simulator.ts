import { Router, Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { computeSuggestedPrice } from "../services/pricingEngine";
import { writePriceUpdates } from "../services/priceUpdateWriter";
import {
  startSimulator,
  stopSimulator,
  getSimulatorStatus,
} from "../services/orderSimulator";
import { getRedis, CacheKeys } from "../lib/redisClient";
import { broadcast } from "../lib/sseManager";
import {
  computeInventoryStatus,
  computeLevelPercent,
} from "../lib/inventoryStatus";
import { stockMatrix } from "../data/baselineStock";

const router = Router();
const prisma = new PrismaClient();

// GET /simulator/status
router.get("/status", (_req: Request, res: Response) => {
  res.json(getSimulatorStatus());
});

// POST /simulator/start
router.post("/start", (_req: Request, res: Response) => {
  startSimulator();
  res.json({ message: "Simulator started", status: getSimulatorStatus() });
});

// POST /simulator/stop
router.post("/stop", (_req: Request, res: Response) => {
  stopSimulator();
  res.json({ message: "Simulator stopped", status: getSimulatorStatus() });
});

/**
 * injectForProduct — core per-product injection logic, extracted in
 * Session 18 so it can be reused by both /inject (single call) and
 * /demo-ramp (scripted multi-step spike sequence).
 *
 * Deducts stock proportional to the injected demand, recomputes price
 * via the pricing engine, and broadcasts stock + price updates over SSE.
 * Does NOT create the DemandEvent row or invalidate cache — callers
 * handle that, since /demo-ramp needs to batch those steps differently
 * (e.g. one DemandEvent per product, not per stage).
 *
 * Session 27: now also passes through cappedAtMrp from the pricing engine,
 * so writePriceUpdates() can record/broadcast when a price hit its legal
 * MRP ceiling instead of reflecting the full calculated surge.
 */
async function injectForProduct(
  storeId: string,
  productId: string,
  effectiveMultiplier: number,
): Promise<{
  storeId: string;
  productId: string;
  currentPrice: number;
  surgeMultiplier: number;
  confidence: number;
  usedMlBaseline: boolean;
  reasoning: string;
  cappedAtMrp: boolean;
} | null> {
  const deductionCount = Math.min(Math.round(effectiveMultiplier * 2), 15);

  const inventory = await prisma.inventory.findUnique({
    where: { storeId_productId: { storeId, productId } },
    include: { product: { select: { name: true, sku: true } } },
  });
  if (!inventory) return null;

  const quantityBefore = inventory.quantityOnHand;
  const quantityAfter = Math.max(0, quantityBefore - deductionCount);
  const actualDeducted = quantityBefore - quantityAfter;

  await prisma.inventory
    .update({
      where: { storeId_productId: { storeId, productId } },
      data: { quantityOnHand: quantityAfter },
    })
    .catch((err) => {
      console.error(
        `[Simulator] injectForProduct: failed to decrement stock for product=${productId}`,
        err,
      );
      return null;
    });

  broadcast(
    storeId,
    {
      productId,
      name: inventory.product.name,
      sku: inventory.product.sku,
      unitsOrdered: actualDeducted,
      quantityBefore,
      quantityAfter,
      reorderLevel: inventory.reorderLevel,
      reorderQty: inventory.reorderQty,
      status: computeInventoryStatus(quantityAfter, inventory.reorderLevel),
      levelPercent: computeLevelPercent(
        quantityAfter,
        inventory.reorderLevel,
        inventory.reorderQty,
      ),
      updatedAt: new Date().toISOString(),
    },
    "stock-update",
  );

  try {
    const result = await computeSuggestedPrice({ storeId, productId });
    return {
      storeId,
      productId,
      currentPrice: result.suggestedPrice,
      surgeMultiplier: result.surgeMultiplier,
      confidence: result.confidence,
      usedMlBaseline: result.usedMlBaseline,
      reasoning: result.reasoning,
      cappedAtMrp: result.cappedAtMrp,
    };
  } catch (err) {
    console.error(
      `[Simulator] injectForProduct: failed to compute price for product=${productId}`,
      err,
    );
    return null;
  }
}

// POST /simulator/inject
router.post("/inject", async (req: Request, res: Response) => {
  console.log("[Inject] req.body =", req.body);
  console.log("[Inject] content-type =", req.headers["content-type"]);
  const {
    storeId,
    productId,
    categoryId,
    multiplier = 2.5,
    factor,
  } = req.body as {
    storeId: string;
    productId?: string;
    categoryId?: string;
    multiplier?: number;
    factor?: number;
  };
  if (!storeId) {
    return res.status(400).json({ error: "storeId is required" });
  }
  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const payload: Record<string, unknown> = {
      injected: true,
      multiplier: factor ?? multiplier,
      magnitude: factor ?? multiplier,
    };
    if (productId) payload.productId = productId;
    if (categoryId) payload.categoryId = categoryId;

    const event = await prisma.demandEvent.create({
      data: {
        storeId,
        eventType: "SURGE_INJECT",
        payload: payload as Prisma.InputJsonValue,
      },
    });

    const redis = getRedis();
    const storeKey = CacheKeys.storePrice(storeId);
    await redis.del(storeKey);
    console.log(`[Simulator] Inject: invalidated cache key ${storeKey}`);
    const productKeys = await redis.keys(`price:${storeId}:*`);
    if (productKeys.length > 0) {
      await redis.del(...productKeys);
      console.log(
        `[Simulator] Inject: invalidated ${productKeys.length} product keys for store=${storeId}`,
      );
    }

    let targetProductIds: string[];
    if (productId) {
      targetProductIds = [productId];
    } else {
      const inventoryItems = await prisma.inventory.findMany({
        where: { storeId },
        select: { productId: true },
      });
      targetProductIds = inventoryItems.map((i) => i.productId);
    }

    const effectiveMultiplier = factor ?? multiplier;
    const deductionCount = Math.min(Math.round(effectiveMultiplier * 2), 15);

    const updates = (
      await Promise.all(
        targetProductIds.map((pid) =>
          injectForProduct(storeId, pid, effectiveMultiplier),
        ),
      )
    ).filter((u): u is NonNullable<typeof u> => u !== null);

    await writePriceUpdates(updates);
    console.log(
      `[Simulator] Inject: deducted stock, repriced + broadcast ${updates.length}/${targetProductIds.length} products for store=${storeId}`,
    );

    return res.json({
      message: "Surge injected, stock deducted, repriced, and broadcast",
      event,
      stockDeductedPerProduct: deductionCount,
      cacheInvalidated: { storeKey, productKeys: productKeys.length },
      repriced: updates,
    });
  } catch (err) {
    console.error("[Simulator] /inject error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /simulator/demo-ramp
 * Session 18 — scripted, repeatable spike demo.
 *
 * Step 0: Reset — clears recent DemandEvents for the store so results
 *         aren't confounded by leftover events from a prior run.
 * Step 1: Only selects products whose PricingRule.surgeMultiplierMax is
 *         >= 1.3, since anything capped below that can never register as
 *         "surging" under ZoneCard's threshold, regardless of injection size.
 * Stage 1 (Elevated): greedily injects eligible products one at a time,
 *         re-checking the TRUE store-wide surge percentage after each,
 *         until it lands in the 20-50% band (or runs out of products).
 * Stage 2 (Surge): continues greedily injecting remaining eligible
 *         products until the true percentage exceeds 50%.
 * This guarantees the demo reliably reaches both real zone states,
 * instead of assuming a fixed subset size will land where we expect.
 */
router.post("/demo-ramp", async (req: Request, res: Response) => {
  const { storeId, stageDelayMs = 8000 } = req.body as {
    storeId: string;
    stageDelayMs?: number;
  };

  if (!storeId) {
    return res.status(400).json({ error: "storeId is required" });
  }

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    // ── Step 0: Reset ──
    const deleted = await prisma.demandEvent.deleteMany({ where: { storeId } });
    const redis = getRedis();
    await redis.del(CacheKeys.storePrice(storeId));
    const productKeys = await redis.keys(`price:${storeId}:*`);
    if (productKeys.length > 0) await redis.del(...productKeys);

    const inventoryItems = await prisma.inventory.findMany({
      where: { storeId },
      select: { productId: true },
    });
    const allProductIds = inventoryItems.map((i) => i.productId);
    const totalProducts = allProductIds.length;
    if (totalProducts === 0) {
      return res.status(400).json({ error: "Store has no inventory" });
    }

    const rules = await prisma.pricingRule.findMany({
      where: { storeId, productId: { in: allProductIds } },
      select: { productId: true, surgeMultiplierMax: true },
    });
    const capByProduct = new Map(
      rules.map((r) => [r.productId, r.surgeMultiplierMax]),
    );
    const eligibleProductIds = allProductIds.filter(
      (pid) => (capByProduct.get(pid) ?? 1.5) >= 1.3,
    );

    const FACTOR = 6;

    async function injectOne(productId: string) {
      await prisma.demandEvent.create({
        data: {
          storeId,
          eventType: "SURGE_INJECT",
          payload: {
            injected: true,
            productId,
            magnitude: FACTOR,
            multiplier: FACTOR,
          } as Prisma.InputJsonValue,
        },
      });
      const update = await injectForProduct(storeId, productId, FACTOR);
      if (update) await writePriceUpdates([update]);
      return update;
    }

    /** Recompute ALL products in the store to get the true surge percentage. */
    async function computeActualSurgePercent(): Promise<{
      surgingCount: number;
      percent: number;
    }> {
      const results = await Promise.all(
        allProductIds.map((pid) =>
          computeSuggestedPrice({ storeId, productId: pid }).catch(() => null),
        ),
      );
      const surgingCount = results.filter(
        (r): r is NonNullable<typeof r> =>
          r !== null && r.surgeMultiplier >= 1.3,
      ).length;
      return {
        surgingCount,
        percent: Math.round((surgingCount / totalProducts) * 100),
      };
    }

    /**
     * Greedily inject from `pool` (in order) until `percent` satisfies
     * `isDone`, or the pool is exhausted. Returns which products were
     * injected and the final actual percentage.
     */
    async function rampUntil(
      pool: string[],
      isDone: (percent: number) => boolean,
    ): Promise<{
      injected: string[];
      finalPercent: number;
      finalZoneState: string;
    }> {
      const injected: string[] = [];
      let percent = (await computeActualSurgePercent()).percent;

      for (const pid of pool) {
        if (isDone(percent)) break;
        await injectOne(pid);
        injected.push(pid);
        percent = (await computeActualSurgePercent()).percent;
      }

      const zoneState =
        percent > 50 ? "surge" : percent >= 20 ? "elevated" : "normal";
      return { injected, finalPercent: percent, finalZoneState: zoneState };
    }

    const log: Array<Record<string, unknown>> = [
      {
        stage: "reset",
        deletedEvents: deleted.count,
        totalProducts,
        eligibleForSurge: eligibleProductIds.length,
      },
    ];

    // ── Stage 1: Elevated (target: 20-50%) ──
    const elevatedRun = await rampUntil(eligibleProductIds, (pct) => pct >= 20);
    log.push({
      stage: "elevated",
      injectedProducts: elevatedRun.injected,
      actualSurgePercent: elevatedRun.finalPercent,
      zoneState: elevatedRun.finalZoneState,
    });

    await new Promise((resolve) => setTimeout(resolve, stageDelayMs));

    // ── Stage 2: Surge (target: >50%) — continue from remaining pool ──
    const remainingPool = eligibleProductIds.filter(
      (pid) => !elevatedRun.injected.includes(pid),
    );
    const surgeRun = await rampUntil(remainingPool, (pct) => pct > 50);
    log.push({
      stage: "surge",
      injectedProducts: surgeRun.injected,
      actualSurgePercent: surgeRun.finalPercent,
      zoneState: surgeRun.finalZoneState,
    });

    return res.json({
      message: "Demo ramp complete",
      storeId,
      totalProducts,
      eligibleForSurge: eligibleProductIds.length,
      stageDelayMs,
      stages: log,
    });
  } catch (err) {
    console.error("[Simulator] /demo-ramp error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /simulator/reset/:storeId
 * Session 27 — safe, password-free demo reset.
 *
 * Restores a store's inventory (quantityOnHand + currentPrice) back to
 * Day 1 baseline values from src/data/baselineStock.ts, then clears out
 * everything the simulator writes: DemandEvents, PricingSuggestions, and
 * Redis cache keys. Lets a live demo be reset via one API call — no local
 * terminal, no DB password, ever.
 *
 * Session 27 follow-up: also broadcasts price-update + stock-update over
 * SSE for every restored product, same as /inject and /demo-ramp already
 * do — otherwise the reset only changes the database, and the live
 * dashboard doesn't visually update until the page is manually refreshed.
 *
 * Session 27 (MRP pass): broadcast now also includes mrp + cappedAtMrp so
 * the frontend can display those fields consistently after a reset (always
 * false/uncapped immediately after a reset, since prices go back to their
 * Day 1 baseline values, which by design never exceed MRP).
 */
router.post("/reset/:storeId", async (req: Request, res: Response) => {
  const { storeId } = req.params;

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const baseline = stockMatrix[storeId];
    if (!baseline) {
      return res.status(400).json({ error: "No baseline data for this store" });
    }

    // Fetch current inventory + product info BEFORE resetting, so we know
    // each product's "before" quantity for the stock-update broadcast, and
    // have name/sku/basePrice/mrp on hand for the price-update broadcast.
    const inventoryBefore = await prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: {
          select: { id: true, name: true, sku: true, basePrice: true, mrp: true },
        },
      },
    });
    const beforeByProduct = new Map(inventoryBefore.map((i) => [i.productId, i]));

    // --- Restore inventory to Day 1 values ---
    let restoredCount = 0;
    for (const [productId, entry] of Object.entries(baseline)) {
      const before = beforeByProduct.get(productId);
      if (!before) continue;

      await prisma.inventory
        .update({
          where: { storeId_productId: { storeId, productId } },
          data: {
            quantityOnHand: entry.qty,
            reorderLevel: entry.reorderLevel,
            reorderQty: entry.reorderQty,
            currentPrice: entry.currentPrice,
          },
        })
        .then(() => {
          restoredCount++;

          const nowIso = new Date().toISOString();

          // Broadcast the restored price, same shape as /inject uses
          broadcast(
            storeId,
            {
              productId,
              productName: before.product.name,
              sku: before.product.sku,
              basePrice: before.product.basePrice,
              mrp: before.product.mrp,
              currentPrice: entry.currentPrice,
              surgeMultiplier: 1.0,
              confidence: 0,
              cappedAtMrp: false,
              explanation: null,
              updatedAt: nowIso,
            },
            "price-update",
          );

          // Broadcast the restored stock level, same shape as injectForProduct uses
          broadcast(
            storeId,
            {
              productId,
              name: before.product.name,
              sku: before.product.sku,
              unitsOrdered: 0,
              quantityBefore: before.quantityOnHand,
              quantityAfter: entry.qty,
              reorderLevel: entry.reorderLevel,
              reorderQty: entry.reorderQty,
              status: computeInventoryStatus(entry.qty, entry.reorderLevel),
              levelPercent: computeLevelPercent(
                entry.qty,
                entry.reorderLevel,
                entry.reorderQty,
              ),
              updatedAt: nowIso,
            },
            "stock-update",
          );
        })
        .catch((err) => {
          console.error(
            `[Simulator] Reset: failed to restore product=${productId}`,
            err,
          );
        });
    }

    // --- Clear simulated history ---
    const deletedEvents = await prisma.demandEvent.deleteMany({ where: { storeId } });
    const deletedSuggestions = await prisma.pricingSuggestion.deleteMany({ where: { storeId } });

    // --- Clear cache ---
    const redis = getRedis();
    await redis.del(CacheKeys.storePrice(storeId));
    const productKeys = await redis.keys(`price:${storeId}:*`);
    if (productKeys.length > 0) await redis.del(...productKeys);

    console.log(
      `[Simulator] Reset: store=${storeId} restored=${restoredCount} deletedEvents=${deletedEvents.count} deletedSuggestions=${deletedSuggestions.count}`,
    );

    return res.json({
      message: "Store reset to baseline",
      storeId,
      productsRestored: restoredCount,
      deletedDemandEvents: deletedEvents.count,
      deletedPricingSuggestions: deletedSuggestions.count,
      cacheCleared: { storeKey: true, productKeys: productKeys.length },
    });
  } catch (err) {
    console.error("[Simulator] /reset error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;