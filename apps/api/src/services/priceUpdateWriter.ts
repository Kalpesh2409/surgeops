import { PrismaClient } from "@prisma/client";
import { getRedis, CacheKeys } from "../lib/redisClient";

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
    const { storeId, productId, currentPrice, surgeMultiplier, confidence } = update;

    const existing = await prisma.inventory.findFirst({
      where: { storeId, productId },
      select: { id: true, currentPrice: true },
    });

    if (!existing) {
      console.warn(`[PriceWriter] No inventory row for store=${storeId} product=${productId}`);
      continue;
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
          updatedAt: new Date().toISOString(),
          source: "epsilon-skip",
        })
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
      updatedAt: new Date().toISOString(),
    };

    const result = await redis.setex(
      CacheKeys.productPrice(storeId, productId),
      60,
      JSON.stringify(cachePayload)
    );

    console.log(
      `[PriceWriter] Updated price for store=${storeId} product=${productId} ` +
      `price=₹${currentPrice} multiplier=${surgeMultiplier.toFixed(2)} [DB+Cache] setex=${result}`
    );
  }
}