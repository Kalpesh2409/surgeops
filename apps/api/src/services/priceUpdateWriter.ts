import { PrismaClient } from "@prisma/client";
import { getRedis, CacheKeys } from "../lib/redisClient";
import { broadcast } from "../lib/sseManager";
import { buildExplanation } from "./explanationBuilder";

const prisma = new PrismaClient();

export interface PriceUpdate {
  storeId: string;
  productId: string;
  currentPrice: number;
  surgeMultiplier: number;
  confidence: number;
  cappedAtMrp?: boolean;
}

const EPSILON = 0.01;

export async function writePriceUpdates(updates: PriceUpdate[]): Promise<void> {
  if (updates.length === 0) return;
  const redis = getRedis();

  for (const update of updates) {
    const {
      storeId,
      productId,
      currentPrice,
      surgeMultiplier,
      confidence,
      cappedAtMrp = false,
    } = update;

    const existing = await prisma.inventory.findFirst({
      where: { storeId, productId },
      select: {
        id: true,
        currentPrice: true,
        product: { select: { name: true, sku: true, basePrice: true, mrp: true } },
      },
    });

    if (!existing) {
      console.warn(
        `[PriceWriter] No inventory row for store=${storeId} product=${productId}`,
      );
      continue;
    }

    const { name: productName, sku, basePrice, mrp } = existing.product;

    const delta = Math.abs(currentPrice - Number(existing.currentPrice));
    // Session 27 fix: an MRP-capped price often lands exactly back at the
    // same number it started at (common when mrp == basePrice), which used
    // to get silently skipped by this epsilon-skip shortcut — hiding the
    // "capped" badge from the live dashboard even though capping genuinely
    // happened. Now: always proceed past the skip when cappedAtMrp is true.
    if (delta < EPSILON && !cappedAtMrp) {
      // Price change too small — still refresh cache TTL. Explanation is
      // computed fresh here too (cheap, deterministic — no cache needed).
      const explanation = buildExplanation({
        productName,
        basePrice,
        currentPrice: Number(existing.currentPrice),
        cappedAtMrp,
        confidence,
      });

      await redis.setex(
        CacheKeys.productPrice(storeId, productId),
        60,
        JSON.stringify({
          currentPrice: Number(existing.currentPrice),
          surgeMultiplier,
          confidence,
          basePrice,
          mrp,
          cappedAtMrp,
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

    // Session 27+ (Gemini removed): explanation is now built instantly from
    // the same numbers we're already writing — no external API call, no
    // cache lookup, no staleness to worry about. It is always guaranteed to
    // match the price and reason being written in this same update.
    const explanation = buildExplanation({
      productName,
      basePrice,
      currentPrice,
      cappedAtMrp,
      confidence,
    });

    // --- Redis cache write (TTL 60s) ---
    const cachePayload = {
      currentPrice,
      surgeMultiplier,
      confidence,
      basePrice,
      mrp,
      cappedAtMrp,
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
        `price=₹${currentPrice} multiplier=${surgeMultiplier.toFixed(2)}` +
        `${cappedAtMrp ? " [CAPPED AT MRP]" : ""} [DB+Cache] setex=${result}`,
    );

    // ── SSE broadcast ──────────────────────────────────────────────────
    broadcast(storeId, {
      productId,
      productName,
      sku,
      basePrice,
      mrp,
      currentPrice,
      surgeMultiplier,
      confidence,
      cappedAtMrp,
      explanation,
      updatedAt: new Date().toISOString(),
    });
  }
}