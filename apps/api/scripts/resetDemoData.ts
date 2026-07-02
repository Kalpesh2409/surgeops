/**
 * resetDemoData.ts
 *
 * Resets SurgeOps demo/test data to a clean baseline:
 *   1. Sets every Inventory.currentPrice back to its Product.basePrice
 *   2. Deletes all DemandEvent rows (clears accumulated demand history)
 *   3. Deletes all PricingSuggestion audit rows (optional — keeps DB tidy)
 *   4. Flushes Redis price cache keys for all stores
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

  // 1. Reset all inventory prices back to product base price
  const inventoryItems = await prisma.inventory.findMany({
    include: { product: { select: { basePrice: true } } },
  });

  let priceResetCount = 0;
  for (const item of inventoryItems) {
    await prisma.inventory.update({
      where: { id: item.id },
      data: { currentPrice: item.product.basePrice },
    });
    priceResetCount++;
  }
  console.log(`[Reset] Reset ${priceResetCount} inventory prices to base price`);

  // 2. Delete all demand events
  const deletedEvents = await prisma.demandEvent.deleteMany({});
  console.log(`[Reset] Deleted ${deletedEvents.count} demand events`);

  // 3. Delete all pricing suggestion audit rows
  const deletedSuggestions = await prisma.pricingSuggestion.deleteMany({});
  console.log(`[Reset] Deleted ${deletedSuggestions.count} pricing suggestions`);

  // 4. Flush Redis price cache
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