import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getRedis, CacheKeys } from "../lib/redisClient";
import { startDemandIngestionLoop } from "../services/demandIngestionLoop";

const router = Router();
const prisma = new PrismaClient();

// ─── GET /pricing/current/:storeId ────────────────────────────────────────────
// Returns current prices for all products in a store.
// Cache-first: checks store:{storeId}:prices (TTL 30s) → DB fallback.
router.get("/current/:storeId", async (req: Request, res: Response) => {
  const { storeId } = req.params;
  const redis = getRedis();
  const cacheKey = CacheKeys.storePrice(storeId);

  try {
    // --- Cache check ---
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[Pricing] CACHE HIT  store=${storeId} key=${cacheKey}`);
      return res.json({
        source: "cache",
        storeId,
        prices: JSON.parse(cached),
      });
    }

    console.log(`[Pricing] CACHE MISS store=${storeId} key=${cacheKey} → DB`);

    // --- DB fallback ---
    const inventory = await prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: {
          select: { id: true, name: true, sku: true, basePrice: true },
        },
      },
    });

    if (inventory.length === 0) {
      return res.status(404).json({ error: "Store not found or no inventory" });
    }

    // Latest confidence per product, from the most recent PricingSuggestion row
    const latestSuggestions = await prisma.pricingSuggestion.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      distinct: ["productId"],
      select: { productId: true, confidence: true },
    });
    const confidenceByProduct = new Map(
      latestSuggestions.map((s) => [s.productId, s.confidence]),
    );

    const prices = inventory.map((inv) => {
      const basePrice = inv.product.basePrice;
      const currentPrice = Number(inv.currentPrice);
      const surgeMultiplier =
        basePrice > 0 ? parseFloat((currentPrice / basePrice).toFixed(4)) : 1.0;

      return {
        productId: inv.productId,
        productName: inv.product.name,
        sku: inv.product.sku,
        basePrice,
        currentPrice,
        surgeMultiplier,
        confidence: confidenceByProduct.get(inv.productId) ?? 0,
        stockQuantity: inv.quantityOnHand,
        stockStatus: deriveStockStatus(inv.quantityOnHand, inv.reorderLevel),
        updatedAt: inv.updatedAt.toISOString(),
      };
    });

    // Warm the cache after DB fallback
    await redis.setex(cacheKey, 30, JSON.stringify(prices));
    console.log(`[Pricing] Warmed cache for store=${storeId}`);

    return res.json({ source: "db", storeId, prices });
  } catch (err) {
    console.error("[Pricing] /current error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /pricing/product/:productId ──────────────────────────────────────────
// Returns prices for a specific product across all stores.
// Cache-first: checks price:{storeId}:{productId} per store → DB fallback.
router.get("/product/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;
  const redis = getRedis();

  try {
    // Find all stores that carry this product
    const inventoryRows = await prisma.inventory.findMany({
      where: { productId },
      include: {
        store: { select: { id: true, name: true, city: true } },
        product: { select: { id: true, name: true, sku: true } },
      },
    });

    if (inventoryRows.length === 0) {
      return res.status(404).json({ error: "Product not found in any store" });
    }

    const results = await Promise.all(
      inventoryRows.map(async (inv) => {
        const cacheKey = CacheKeys.productPrice(inv.storeId, productId);
        const cached = await redis.get(cacheKey);

        if (cached) {
          console.log(
            `[Pricing] CACHE HIT  product=${productId} store=${inv.storeId}`,
          );
          const parsed = JSON.parse(cached);
          return {
            storeId: inv.storeId,
            storeName: inv.store.name,
            city: inv.store.city,
            source: "cache",
            ...parsed,
          };
        }

        console.log(
          `[Pricing] CACHE MISS product=${productId} store=${inv.storeId} → DB`,
        );
        return {
          storeId: inv.storeId,
          storeName: inv.store.name,
          city: inv.store.city,
          productId: inv.productId,
          productName: inv.product.name,
          sku: inv.product.sku,
          currentPrice: Number(inv.currentPrice),
          stockQuantity: inv.quantityOnHand,
          stockStatus: deriveStockStatus(inv.quantityOnHand, inv.reorderLevel),
          updatedAt: inv.updatedAt.toISOString(),
          source: "db",
        };
      }),
    );

    return res.json({ productId, stores: results });
  } catch (err) {
    console.error("[Pricing] /product error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /pricing/compare/:storeId ─────────────────────────────────────────────
// Returns rules-engine vs ML pricing suggestions side by side, per product,
// for the ML comparison panel (Session 14).
// Rules-engine price uses Inventory.currentPrice as the source of truth
// (falls back to it since writePriceUpdates() only writes a PricingSuggestion
// audit row when price actually changes — epsilon-skip means many products
// won't have a recent surge_engine_v1 row even though the price is current).
router.get("/compare/:storeId", async (req: Request, res: Response) => {
  const { storeId } = req.params;

  try {
    const inventory = await prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: {
          select: { id: true, name: true, sku: true, basePrice: true },
        },
      },
    });

    if (inventory.length === 0) {
      return res.status(404).json({ error: "Store not found or no inventory" });
    }

    // Latest audit rows per product per model (for confidence + timestamps)
    const rulesSuggestions = await prisma.pricingSuggestion.findMany({
      where: { storeId, model: "surge_engine_v1" },
      orderBy: { createdAt: "desc" },
      distinct: ["productId"],
    });
    const mlSuggestions = await prisma.pricingSuggestion.findMany({
      where: { storeId, model: "random_forest_v1" },
      orderBy: { createdAt: "desc" },
      distinct: ["productId"],
    });

    const rulesByProduct = new Map(
      rulesSuggestions.map((s) => [s.productId, s]),
    );
    const mlByProduct = new Map(mlSuggestions.map((s) => [s.productId, s]));

    const comparison = inventory.map((inv) => {
      const rulesAudit = rulesByProduct.get(inv.productId);
      const ml = mlByProduct.get(inv.productId);

      // Rules-engine price: live Inventory.currentPrice is authoritative
      const rulesPrice = Number(inv.currentPrice);
      const mlPrice = ml?.suggestedPrice ?? null;
      const delta =
        mlPrice !== null ? parseFloat((rulesPrice - mlPrice).toFixed(2)) : null;

      return {
        productId: inv.productId,
        productName: inv.product.name,
        sku: inv.product.sku,
        basePrice: inv.product.basePrice,
        rulesEngine: {
          suggestedPrice: rulesPrice,
          confidence: rulesAudit?.confidence ?? 0,
          updatedAt: (rulesAudit?.createdAt ?? inv.updatedAt).toISOString(),
        },
        ml: ml
          ? {
              suggestedPrice: mlPrice,
              confidence: ml.confidence,
              updatedAt: ml.createdAt.toISOString(),
            }
          : null,
        delta,
      };
    });

    return res.json({ storeId, comparison });
  } catch (err) {
    console.error("[Pricing] /compare error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /pricing/recalculate ─────────────────────────────────────────────────
// Invalidates cache for the store, then triggers a fresh ingestion tick.
router.post("/recalculate", async (req: Request, res: Response) => {
  const { storeId } = req.body as { storeId?: string };

  if (!storeId) {
    return res.status(400).json({ error: "storeId is required" });
  }

  const redis = getRedis();

  try {
    // --- Cache invalidation ---
    // Delete store-level aggregate
    const storeKey = CacheKeys.storePrice(storeId);
    await redis.del(storeKey);
    console.log(`[Pricing] Invalidated cache key: ${storeKey}`);

    // Delete all product-level keys for this store
    const productKeys = await redis.keys(`price:${storeId}:*`);
    if (productKeys.length > 0) {
      await redis.del(...productKeys);
      console.log(
        `[Pricing] Invalidated ${productKeys.length} product cache keys for store=${storeId}`,
      );
    }

    // --- Restart ingestion loop to trigger a fresh tick ---
    // The loop will pick up any recent DemandEvents and reprice
    startDemandIngestionLoop();

    return res.json({
      message: "Cache invalidated and repricing triggered",
      storeId,
      keysInvalidated: 1 + productKeys.length,
    });
  } catch (err) {
    console.error("[Pricing] /recalculate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────────
function deriveStockStatus(
  quantityOnHand: number,
  reorderLevel: number,
): string {
  if (quantityOnHand === 0) return "OUT_OF_STOCK";
  if (quantityOnHand <= reorderLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

export default router;
