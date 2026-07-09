import { PrismaClient } from "@prisma/client";
import { computeSuggestedPrice } from "./pricingEngine";
import { writePriceUpdates } from "./priceUpdateWriter";
import { getRedis, CacheKeys } from "../lib/redisClient";
import { generatePriceExplanation } from "./geminiExplainer";

const prisma = new PrismaClient();

let loopTimer: ReturnType<typeof setInterval> | null = null;
let highWaterMark: Date = new Date(0); // deduplication cursor

const POLL_INTERVAL_MS = 15_000;
const EXPLANATION_EPSILON = 0.5; // ₹ — skip Gemini call if price hasn't moved beyond this
const MAX_GEMINI_CALLS_PER_TICK = 4; // stay safely under free-tier 5 RPM limit

let geminiCallsUsedThisTick = 0;

async function tick(): Promise<void> {
  try {
    geminiCallsUsedThisTick = 0; // reset budget for this tick

    // --- Fetch new DemandEvents since last high-water mark ---
    const newEvents = await prisma.demandEvent.findMany({
      where: { recordedAt: { gt: highWaterMark } },
      orderBy: { recordedAt: "asc" },
    });
    if (newEvents.length === 0) {
      console.log(
        "[DemandLoop] No new events since",
        highWaterMark.toISOString(),
      );
      return;
    }

    // Advance high-water mark
    highWaterMark = newEvents[newEvents.length - 1].recordedAt;

    // Deduplicate by store
    const storeIds = [...new Set(newEvents.map((e) => e.storeId))];

    console.log(
      `[DemandLoop] Processing ${newEvents.length} events across ${storeIds.length} stores`,
    );

    const redis = getRedis();

    for (const storeId of storeIds) {
      const storeEvents = newEvents.filter((e) => e.storeId === storeId);

      // Compute surge prices for this store
      const inventoryItems = await prisma.inventory.findMany({
        where: { storeId },
        select: { productId: true },
      });

      const updates = (
        await Promise.all(
          inventoryItems.map((inv) =>
            computeSuggestedPrice({ storeId, productId: inv.productId })
              .then((result) => ({
                storeId,
                productId: inv.productId,
                currentPrice: result.suggestedPrice,
                surgeMultiplier: result.surgeMultiplier,
                confidence: result.confidence,
              }))
              .catch(() => null),
          ),
        )
      ).filter((u): u is NonNullable<typeof u> => u !== null);
      // Write to DB + individual product cache keys
      await writePriceUpdates(updates);

      // --- Write store-level aggregate cache (TTL 30s) ---
      // Fetch current inventory prices for this store after updates
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { name: true },
      });

      const inventory = await prisma.inventory.findMany({
        where: { storeId },
        include: {
          product: {
            select: { id: true, name: true, sku: true, basePrice: true },
          },
        },
      });

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

      const storeAgg = await Promise.all(
        inventory.map(async (inv) => {
          const basePrice = inv.product.basePrice;
          const currentPrice = Number(inv.currentPrice);
          const surgeMultiplier =
            basePrice > 0
              ? parseFloat((currentPrice / basePrice).toFixed(4))
              : 1.0;
          const confidence = confidenceByProduct.get(inv.productId) ?? 0;

          // --- Epsilon-skip cached Gemini explanation, rate-limited per tick ---
          let explanation: string | null = null;
          const cacheKey = CacheKeys.explanation(storeId, inv.productId);

          try {
            const cachedRaw = await redis.get(cacheKey);
            const cached = cachedRaw
              ? (JSON.parse(cachedRaw) as {
                  explanation: string;
                  lastPrice: number;
                })
              : null;

            if (
              cached &&
              Math.abs(cached.lastPrice - currentPrice) < EXPLANATION_EPSILON
            ) {
              explanation = cached.explanation;
            } else if (geminiCallsUsedThisTick >= MAX_GEMINI_CALLS_PER_TICK) {
              // Rate-limit budget exhausted this tick — reuse stale cache if any, else skip
              explanation = cached?.explanation ?? null;
            } else {
              geminiCallsUsedThisTick++; // reserve the slot before awaiting
              const generated = await generatePriceExplanation({
                productName: inv.product.name,
                storeName: store?.name ?? storeId,
                basePrice,
                currentPrice,
                surgeMultiplier,
                confidence,
              });

              if (generated) {
                explanation = generated;
                await redis.set(
                  cacheKey,
                  JSON.stringify({
                    explanation: generated,
                    lastPrice: currentPrice,
                  }),
                );
              } else if (cached) {
                // Gemini failed this round — fall back to stale cached value rather than nothing
                explanation = cached.explanation;
              }
            }
          } catch (err) {
            console.error(
              `[DemandLoop] Explanation cache error for ${inv.productId}:`,
              err,
            );
          }

          return {
            productId: inv.productId,
            productName: inv.product.name,
            sku: inv.product.sku,
            basePrice,
            currentPrice,
            surgeMultiplier,
            confidence,
            explanation,
            stockQuantity: inv.quantityOnHand,
            stockStatus: deriveStockStatus(
              inv.quantityOnHand,
              inv.reorderLevel,
            ),
            updatedAt: inv.updatedAt.toISOString(),
          };
        }),
      );

      await redis.setex(
        CacheKeys.storePrice(storeId),
        30,
        JSON.stringify(storeAgg),
      );

      console.log(
        `[DemandLoop] Store ${storeId}: wrote aggregate cache (${storeAgg.length} products, TTL 30s)`,
      );
    }
  } catch (err) {
    console.error("[DemandLoop] Tick error:", err);
  }
}

function deriveStockStatus(
  quantityOnHand: number,
  reorderLevel: number,
): string {
  if (quantityOnHand === 0) return "OUT_OF_STOCK";
  if (quantityOnHand <= reorderLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

export function startDemandIngestionLoop(): void {
  if (loopTimer) {
    console.warn("[DemandLoop] Already running");
    return;
  }
  console.log(
    `[DemandLoop] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`,
  );
  // Run immediately, then on interval
  tick();
  loopTimer = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopDemandIngestionLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    console.log("[DemandLoop] Stopped");
  }
}