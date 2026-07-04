/**
 * resetDemoData.ts
 *
 * Resets SurgeOps demo/test data to a clean baseline:
 *   1. Sets every Inventory.currentPrice back to its Product.basePrice
 *   2. Restocks every Inventory.quantityOnHand back to (reorderLevel + reorderQty)
 *   3. Deletes all DemandEvent rows (clears accumulated demand history)
 *   4. Deletes all PricingSuggestion audit rows
 *   5. Flushes Redis price cache keys for all stores
 *
 * Usage:
 *   cd apps/api
 *   npx ts-node scripts/resetDemoData.ts
 */

import { PrismaClient } from "@prisma/client";
import { getRedis, disconnectRedis } from "../src/lib/redisClient";

const prisma = new PrismaClient();

async function resetDemoData() {
  console.log("[Reset] Starting demo data reset...\n");

  // 1 & 2. Reset price AND restock quantity together, per inventory row
  const inventoryItems = await prisma.inventory.findMany({
    include: { product: { select: { basePrice: true } } },
  });

  let resetCount = 0;
  for (const item of inventoryItems) {
    const restockedQty = item.reorderLevel + item.reorderQty;
    await prisma.inventory.update({
      where: { id: item.id },
      data: {
        currentPrice: item.product.basePrice,
        quantityOnHand: restockedQty,
      },
    });
    resetCount++;
  }
  console.log(
    `[Reset] Reset ${resetCount} inventory rows: price -> basePrice, stock -> (reorderLevel + reorderQty)`,
  );

  // 3. Delete all demand events
  const deletedEvents = await prisma.demandEvent.deleteMany({});
  console.log(`[Reset] Deleted ${deletedEvents.count} demand events`);

  // 4. Delete all pricing suggestion audit rows
  const deletedSuggestions = await prisma.pricingSuggestion.deleteMany({});
  console.log(`[Reset] Deleted ${deletedSuggestions.count} pricing suggestions`);

  // 5. Flush Redis price cache
  const redis = getRedis();
  const stores = await prisma.store.findMany({ select: { id: true } });
  let cacheKeysDeleted = 0;

  for (const store of stores) {
    const storeKey = `store:${store.id}:prices`;
    await redis.del(storeKey);
    cacheKeysDeleted++;

    const productKeys = await redis.keys(`price:${store.id}:*`);
    if (productKeys.length > 0) {
      await redis.del(...productKeys);
      cacheKeysDeleted += productKeys.length;
    }
  }
  console.log(`[Reset] Cleared ${cacheKeysDeleted} Redis cache keys`);

  console.log("\n[Reset] Done — demo data is back to a clean baseline.");
}

resetDemoData()
  .catch((err) => {
    console.error("[Reset] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await disconnectRedis();
  });