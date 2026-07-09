import { PrismaClient } from "@prisma/client";
import { getRedis, CacheKeys } from "../lib/redisClient";
import { broadcast } from "../lib/sseManager";

const prisma = new PrismaClient();

export interface PriceUpdate {
  storeId: string;
  productId: string;
  currentPrice: number;
  surgeMultiplier: number;
  confidence: number;
}

const EPSILON = 0.01;

export async function writePriceUpdates(updates: PriceUpdate[]): Promise<void> {
  if (updates.length === 0) return;
  const redis = getRedis();

  for (const update of updates) {
    const { storeId, productId, currentPrice, surgeMultiplier, confidence } =
      update;

    const existing = await prisma.inventory.findFirst({
      where: { storeId, productId },
      select: {
        id: true,
        currentPrice: true,
        product: { select: { name: true, sku: true, basePrice: true } },
      },
    });

    if (!existing) {
      console.warn(
        `[PriceWriter] No inventory row for store=${storeId} product=${productId}`,
      );
      continue;
    }

    const { name: productName, sku, basePrice } = existing.product;

    // Look up any previously-cached explanation (no TTL — persists across ticks)
    let explanation: string | null = null;
    try {
      const cachedExplanationRaw = await redis.get(
        CacheKeys.explanation(storeId, productId),
      );
      if (cachedExplanationRaw) {
        explanation = (JSON.parse(cachedExplanationRaw) as { explanation: string }).explanation;
      }
    } catch (err) {
      console.error(`[PriceWriter] Explanation lookup error for ${productId}:`, err);
    }

    const delta = Math.abs(currentPrice - Number(existing.currentPrice));
    if (delta < EPSILON) {
      // Price change too small — still refresh cache TTL
      await redis.setex(
        CacheKeys.productPrice(storeId, productId),
        60,
        JSON.stringify({
          currentPrice: Number(existing.currentPrice),
          surgeMultiplier,
          confidence,
          basePrice,
          explanation,
          updatedAt: new Date().toISOString(),
          source: "epsilon-skip",
        }),
      );
      continue;
    }

    // --- DB write ---
    await prisma.inventory.update({
      where: { id: existing.id },
      data: { currentPrice },
    });

    // --- PricingSuggestion audit row ---
    await prisma.pricingSuggestion.create({
      data: {
        storeId,
        productId,
        suggestedPrice: currentPrice,
        confidence,
        model: "surge_engine_v1",
        appliedAt: new Date(),
      },
    });

    // --- Redis cache write (TTL 60s) ---
    const cachePayload = {
      currentPrice,
      surgeMultiplier,
      confidence,
      basePrice,
      explanation,
      updatedAt: new Date().toISOString(),
    };
    const result = await redis.setex(
      CacheKeys.productPrice(storeId, productId),
      60,
      JSON.stringify(cachePayload),
    );

    console.log(
      `[PriceWriter] Updated price for store=${storeId} product=${productId} ` +
        `price=₹${currentPrice} multiplier=${surgeMultiplier.toFixed(2)} [DB+Cache] setex=${result}`,
    );

    // ── SSE broadcast ──────────────────────────────────────────────────
    broadcast(storeId, {
      productId,
      productName,
      sku,
      basePrice,
      currentPrice,
      surgeMultiplier,
      confidence,
      explanation,
      updatedAt: new Date().toISOString(),
    });
  }
}