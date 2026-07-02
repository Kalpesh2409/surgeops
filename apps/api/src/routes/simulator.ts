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
import { computeInventoryStatus, computeLevelPercent } from "../lib/inventoryStatus";

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

    // --- Deduct stock proportional to injected demand, and broadcast
    //     a stock-update SSE event per product so the UI reflects it live ---
    const effectiveMultiplier = factor ?? multiplier;
    const deductionCount = Math.min(Math.round(effectiveMultiplier * 2), 15);

    await Promise.all(
      targetProductIds.map(async (pid) => {
        const inventory = await prisma.inventory.findUnique({
          where: { storeId_productId: { storeId, productId: pid } },
          include: { product: { select: { name: true, sku: true } } },
        });
        if (!inventory) return;

        const quantityBefore = inventory.quantityOnHand;
        const quantityAfter = Math.max(0, quantityBefore - deductionCount);
        const actualDeducted = quantityBefore - quantityAfter;

        await prisma.inventory
          .update({
            where: { storeId_productId: { storeId, productId: pid } },
            data: { quantityOnHand: quantityAfter },
          })
          .catch((err) => {
            console.error(
              `[Simulator] Inject: failed to decrement stock for product=${pid}`,
              err,
            );
            return null;
          });

        broadcast(
          storeId,
          {
            productId: pid,
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
      }),
    );
    console.log(
      `[Simulator] Inject: deducted ~${deductionCount} units from ${targetProductIds.length} products (multiplier=${effectiveMultiplier})`,
    );

    const updates = (
      await Promise.all(
        targetProductIds.map((pid) =>
          computeSuggestedPrice({ storeId, productId: pid })
            .then((result) => ({
              storeId,
              productId: pid,
              currentPrice: result.suggestedPrice,
              surgeMultiplier: result.surgeMultiplier,
              confidence: result.confidence,
            }))
            .catch((err) => {
              console.error(
                `[Simulator] Inject: failed to compute price for product=${pid}`,
                err,
              );
              return null;
            }),
        ),
      )
    ).filter((u): u is NonNullable<typeof u> => u !== null);

    await writePriceUpdates(updates);
    console.log(
      `[Simulator] Inject: repriced + broadcast ${updates.length}/${targetProductIds.length} products for store=${storeId}`,
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

export default router;