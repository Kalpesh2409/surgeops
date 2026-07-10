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
    const capByProduct = new Map(rules.map((r) => [r.productId, r.surgeMultiplierMax]));
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
        (r): r is NonNullable<typeof r> => r !== null && r.surgeMultiplier >= 1.3,
      ).length;
      return { surgingCount, percent: Math.round((surgingCount / totalProducts) * 100) };
    }

    /**
     * Greedily inject from `pool` (in order) until `percent` satisfies
     * `isDone`, or the pool is exhausted. Returns which products were
     * injected and the final actual percentage.
     */
    async function rampUntil(
      pool: string[],
      isDone: (percent: number) => boolean,
    ): Promise<{ injected: string[]; finalPercent: number; finalZoneState: string }> {
      const injected: string[] = [];
      let percent = (await computeActualSurgePercent()).percent;

      for (const pid of pool) {
        if (isDone(percent)) break;
        await injectOne(pid);
        injected.push(pid);
        percent = (await computeActualSurgePercent()).percent;
      }

      const zoneState = percent > 50 ? "surge" : percent >= 20 ? "elevated" : "normal";
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
    const elevatedRun = await rampUntil(
      eligibleProductIds,
      (pct) => pct >= 20,
    );
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

export default router;
