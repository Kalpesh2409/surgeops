/**
 * pricing.ts — SurgeOps Session 5
 *
 * Express router: pricing query + control endpoints
 *
 * GET  /pricing/current/:storeId        → current prices for all products in a store
 * GET  /pricing/product/:productId      → pricing history across all stores
 * POST /pricing/recalculate             → trigger immediate ingestion tick
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { computeSuggestedPrice } from "../services/pricingEngine";
import { writePriceUpdate } from "../services/priceUpdateWriter";
import {
  getDemandIngestionStats,
  triggerImmediateTick,
} from "../services/demandIngestionLoop";

const router = Router();
const prisma = new PrismaClient();

// ── GET /pricing/current/:storeId ─────────────────────────────────────────────

router.get("/current/:storeId", async (req: Request, res: Response) => {
  const { storeId } = req.params;

  try {
    // Verify store exists
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ error: "Store not found", storeId });
    }

    // Fetch all inventory rows for this store
    const inventoryRows = await prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: {
          select: { id: true, name: true, sku: true, basePrice: true, unit: true },
        },
      },
      orderBy: { product: { name: "asc" } },
    });

    // For each product, grab the latest PricingSuggestion
    const productIds = inventoryRows.map((r) => r.productId);

    const latestSuggestions = await Promise.all(
      productIds.map((productId) =>
        prisma.pricingSuggestion.findFirst({
          where: { storeId, productId },
          orderBy: { createdAt: "desc" },
          select: {
            suggestedPrice: true,
            confidence: true,
            model: true,
            appliedAt: true,
            createdAt: true,
          },
        })
      )
    );

    const items = inventoryRows.map((inv, i) => ({
      productId: inv.productId,
      sku: inv.product.sku,
      name: inv.product.name,
      unit: inv.product.unit,
      basePrice: inv.product.basePrice,
      currentPrice: inv.currentPrice,
      surgeMultiplier:
        inv.product.basePrice > 0
          ? parseFloat((inv.currentPrice / inv.product.basePrice).toFixed(4))
          : 1,
      quantityOnHand: inv.quantityOnHand,
      lastSuggestion: latestSuggestions[i] ?? null,
    }));

    return res.json({
      storeId,
      storeName: store.name,
      city: store.city,
      totalProducts: items.length,
      ingestionStats: getDemandIngestionStats(),
      items,
    });
  } catch (err) {
    console.error("[GET /pricing/current]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /pricing/product/:productId ──────────────────────────────────────────

router.get("/product/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: { select: { name: true, slug: true } } },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found", productId });
    }

    // Fetch inventory across all stores
    const inventoryRows = await prisma.inventory.findMany({
      where: { productId },
      include: { store: { select: { id: true, name: true, city: true } } },
    });

    // Most recent 20 suggestions per store
    const suggestionsByStore = await Promise.all(
      inventoryRows.map(async (inv) => {
        const suggestions = await prisma.pricingSuggestion.findMany({
          where: { storeId: inv.storeId, productId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            suggestedPrice: true,
            confidence: true,
            model: true,
            appliedAt: true,
            createdAt: true,
          },
        });
        return { storeId: inv.storeId, suggestions };
      })
    );

    const suggestionMap = new Map(
      suggestionsByStore.map((s) => [s.storeId, s.suggestions])
    );

    const stores = inventoryRows.map((inv) => ({
      storeId: inv.storeId,
      storeName: inv.store.name,
      city: inv.store.city,
      currentPrice: inv.currentPrice,
      surgeMultiplier:
        product.basePrice > 0
          ? parseFloat((inv.currentPrice / product.basePrice).toFixed(4))
          : 1,
      quantityOnHand: inv.quantityOnHand,
      recentSuggestions: suggestionMap.get(inv.storeId) ?? [],
    }));

    return res.json({
      productId,
      sku: product.sku,
      name: product.name,
      basePrice: product.basePrice,
      unit: product.unit,
      category: product.category,
      stores,
    });
  } catch (err) {
    console.error("[GET /pricing/product]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /pricing/recalculate ─────────────────────────────────────────────────

router.post("/recalculate", async (req: Request, res: Response) => {
  /**
   * Optional body: { storeId, productId }
   * If provided → recalculate that specific pair immediately.
   * If omitted   → trigger a full ingestion tick right now.
   */
  const { storeId, productId } = req.body ?? {};

  try {
    if (storeId && productId) {
      // Single-pair recalculation
      const pricingResult = await computeSuggestedPrice({ storeId, productId });
      const writeResult = await writePriceUpdate(pricingResult);

      return res.json({
        mode: "single",
        ...pricingResult,
        write: writeResult,
      });
    }

    // Full tick
    await triggerImmediateTick();

    return res.json({
      mode: "full_tick",
      message: "Demand ingestion tick triggered",
      stats: getDemandIngestionStats(),
    });
  } catch (err) {
    console.error("[POST /pricing/recalculate]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;