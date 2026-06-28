import { PrismaClient } from "@prisma/client";
import { computeSuggestedPrice } from "./pricingEngine";
import { writePriceUpdates } from "./priceUpdateWriter";
import { getRedis, CacheKeys } from "../lib/redisClient";

const prisma = new PrismaClient();

let loopTimer: ReturnType<typeof setInterval> | null = null;
let highWaterMark: Date = new Date(0); // deduplication cursor

const POLL_INTERVAL_MS = 15_000;

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
      const inventory = await prisma.inventory.findMany({
        where: { storeId },
        include: { product: { select: { id: true, name: true, sku: true } } },
      });

      const storeAgg = inventory.map((inv) => ({
        productId: inv.productId,
        productName: inv.product.name,
        sku: inv.product.sku,
        currentPrice: Number(inv.currentPrice),
        stockQuantity: inv.quantityOnHand,
        stockStatus: deriveStockStatus(inv.quantityOnHand, inv.reorderLevel),
        updatedAt: inv.updatedAt.toISOString(),
      }));

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
