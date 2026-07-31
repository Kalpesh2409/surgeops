import { PrismaClient } from "@prisma/client";
import { computeSuggestedPrice } from "./pricingEngine";
import { writePriceUpdates } from "./priceUpdateWriter";
import { getRedis, CacheKeys } from "../lib/redisClient";
import { buildExplanation } from "./explanationBuilder";

const prisma = new PrismaClient();

let loopTimer: ReturnType<typeof setInterval> | null = null;

// Session 27 (restart-replay fix): this used to start at new Date(0) — the
// very beginning of time. That meant every time the API server restarted
// (a manual restart locally, or a redeploy on Render), this cursor reset
// to zero and the very first tick treated EVERY DemandEvent ever created
// as brand new, replaying the whole day's old activity at once. Starting
// it at "now" means a fresh server boot only looks forward from that
// moment, never backward through history.
let highWaterMark: Date = new Date();

const POLL_INTERVAL_MS = 15_000;

/**
 * Session 27+ (Gemini removed): explanations are now built instantly with
 * buildExplanation() wherever a price is computed — no external API call,
 * no per-tick rate limit, no "pending explanation" queue, no staleness
 * checks. This removed a large amount of complexity that used to live
 * here (EXPLANATION_EPSILON, MAX_GEMINI_CALLS_PER_TICK, the
 * pendingExplanations Set, the CachedExplanation cache shape, and a whole
 * separate "pending-explanation-only tick" code path) — none of it is
 * needed anymore since there's nothing left that can ever go stale or
 * need a retry.
 */

async function tick(): Promise<void> {
  try {
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

      // Compute surge prices for this store
      const inventoryItems = await prisma.inventory.findMany({
        where: { storeId },
        select: { productId: true },
      });

      // Session 27 (MRP pass): capture cappedAtMrp per product from this same
      // computeSuggestedPrice call, so we don't need to call it twice later
      // when building the aggregate cache below.
      const cappedAtMrpByProduct = new Map<string, boolean>();

      // Session 27 (Bug 1 fix): also capture the TRUE surgeMultiplier from
      // the pricing engine here, per product. The storeAgg block below used
      // to recalculate surgeMultiplier as currentPrice / basePrice, which
      // always collapses to 1.00x whenever a price is MRP-capped (since a
      // capped price equals basePrice) — hiding the real demand signal.
      // Reusing the engine's own value fixes that.
      const surgeMultiplierByProduct = new Map<string, number>();

      const updates = (
        await Promise.all(
          inventoryItems.map((inv) =>
            computeSuggestedPrice({ storeId, productId: inv.productId })
              .then((result) => {
                cappedAtMrpByProduct.set(inv.productId, result.cappedAtMrp);
                surgeMultiplierByProduct.set(
                  inv.productId,
                  result.surgeMultiplier,
                );
                return {
                  storeId,
                  productId: inv.productId,
                  currentPrice: result.suggestedPrice,
                  surgeMultiplier: result.surgeMultiplier,
                  confidence: result.confidence,
                  cappedAtMrp: result.cappedAtMrp,
                };
              })
              .catch(() => null),
          ),
        )
      ).filter((u): u is NonNullable<typeof u> => u !== null);
      // Write to DB + individual product cache keys
      await writePriceUpdates(updates);

      // --- Write store-level aggregate cache (TTL 30s) ---
      // Fetch current inventory prices for this store after updates
      const inventory = await prisma.inventory.findMany({
        where: { storeId },
        include: {
          product: {
            select: { id: true, name: true, sku: true, basePrice: true, mrp: true },
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

      const storeAgg = inventory.map((inv) => {
        const basePrice = inv.product.basePrice;
        const mrp = inv.product.mrp;
        const currentPrice = Number(inv.currentPrice);

        // Session 27 (Bug 1 fix): use the real surgeMultiplier captured
        // from the pricing engine above. Fall back to the old ratio
        // calculation only if this product somehow wasn't in the Map
        // (e.g. an inventory row with no matching computeSuggestedPrice
        // call this tick) so we never end up with no value at all.
        const surgeMultiplier =
          surgeMultiplierByProduct.get(inv.productId) ??
          (basePrice > 0
            ? parseFloat((currentPrice / basePrice).toFixed(4))
            : 1.0);

        const confidence = confidenceByProduct.get(inv.productId) ?? 0;
        const cappedAtMrp = cappedAtMrpByProduct.get(inv.productId) ?? false;

        // Session 27+ (Gemini removed): explanation is built instantly,
        // directly from these same values — always accurate, never stale.
        const explanation = buildExplanation({
          productName: inv.product.name,
          basePrice,
          currentPrice,
          cappedAtMrp,
          confidence,
        });

        return {
          productId: inv.productId,
          productName: inv.product.name,
          sku: inv.product.sku,
          basePrice,
          mrp,
          cappedAtMrp,
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
      });

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

  // Session 27 (restart-replay fix): re-confirm the cursor starts at "now"
  // at the moment the loop actually starts, not just at module-load time —
  // covers the (unlikely but possible) case where the module was loaded
  // some time before the server actually starts listening.
  highWaterMark = new Date();

  console.log(
    `[DemandLoop] Starting — polling every ${POLL_INTERVAL_MS / 1000}s (ignoring any DemandEvents older than ${highWaterMark.toISOString()})`,
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