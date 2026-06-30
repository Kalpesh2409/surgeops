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
// Body: { storeId: string, productId?: string, categoryId?: string, multiplier?: number, factor?: number }
// Injects a synthetic surge DemandEvent, then invalidates that store's cache.
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
    // Verify store exists
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }
    // Build payload — include productId so pricingEngine can match events
   const payload: Record<string, unknown> = {
      injected: true,
      multiplier: factor ?? multiplier,
      magnitude: factor ?? multiplier, // pricingEngine reads `magnitude`, not `multiplier`
    };
    if (productId) payload.productId = productId;
    if (categoryId) payload.categoryId = categoryId;
    // Create synthetic DemandEvent
    const event = await prisma.demandEvent.create({
      data: {
        storeId,
        eventType: "SURGE_INJECT",
        payload: payload as Prisma.InputJsonValue,
      },
    });
    // --- Cache invalidation for this store ---
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

    // --- Synchronous reprice + broadcast (don't wait for the 15s poller) ---
    // Determine which products to reprice: a single product if given,
    // otherwise every product currently stocked in this store.
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
      message: "Surge injected, repriced, and broadcast",
      event,
      cacheInvalidated: {
        storeKey,
        productKeys: productKeys.length,
      },
      repriced: updates,
    });
  } catch (err) {
    console.error("[Simulator] /inject error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
