import "dotenv/config";
import { PrismaClient, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Config ─────────────────────────────────────────────────────────
const DAYS_OF_HISTORY = 30;
const SYNTHETIC_PREFIX = "SYNTH-";

// Hourly base weights (0-23), lunch + dinner peaks, overnight low
const HOURLY_WEIGHTS: number[] = [
  1, 1, 1, 1, 1, 2, // 0-5am: near-dead
  4, 6, 7, 6, 6, 8, // 6-11am: morning ramp
  10, 9, 6, 5, 5, 6, // 12-5pm: lunch peak at 12-1pm, afternoon lull
  9, 10, 9, 7, 5, 3, // 6-11pm: dinner peak at 7-8pm, tapering
];

// Weekday index from JS Date.getDay(): 0=Sun ... 6=Sat
const WEEKEND_MULTIPLIER: Record<number, number> = {
  0: 1.3, // Sun
  1: 1.0,
  2: 1.0,
  3: 1.0,
  4: 1.0,
  5: 1.15, // Fri evening uplift
  6: 1.4, // Sat
};

const BASE_ORDERS_PER_HOUR_PEAK = 6; // scales overall volume; tune to hit ~80-120/day

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand(0, total);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("=== SurgeOps Synthetic History Seeder ===\n");

  // 1. Cleanup previous synthetic runs (idempotent)
  console.log("Cleaning up previous synthetic data...");
  const synthOrders = await prisma.order.findMany({
    where: { externalId: { startsWith: SYNTHETIC_PREFIX } },
    select: { id: true },
  });
  const synthOrderIds = synthOrders.map((o) => o.id);

  if (synthOrderIds.length > 0) {
    const deletedItems = await prisma.orderItem.deleteMany({
      where: { orderId: { in: synthOrderIds } },
    });
    const deletedOrders = await prisma.order.deleteMany({
      where: { id: { in: synthOrderIds } },
    });
    console.log(
      `  Removed ${deletedOrders.count} synthetic orders, ${deletedItems.count} order items`
    );
  } else {
    console.log("  No previous synthetic orders found.");
  }

  // DemandEvent payload is Json — filter client-side since Prisma JSON
  // querying on nested boolean varies by provider version; safe fallback.
  const allDemandEvents = await prisma.demandEvent.findMany({
    select: { id: true, payload: true },
  });
  const synthDemandEventIds = allDemandEvents
    .filter((e) => {
      const p = e.payload as any;
      return p && typeof p === "object" && p.synthetic === true;
    })
    .map((e) => e.id);

  if (synthDemandEventIds.length > 0) {
    const deletedEvents = await prisma.demandEvent.deleteMany({
      where: { id: { in: synthDemandEventIds } },
    });
    console.log(`  Removed ${deletedEvents.count} synthetic demand events`);
  } else {
    console.log("  No previous synthetic demand events found.");
  }

  // 2. Fetch stores + products
  const stores = await prisma.store.findMany();
  const products = await prisma.product.findMany();

  if (stores.length === 0 || products.length === 0) {
    console.error(
      "No stores or products found. Run your base seed script first."
    );
    process.exit(1);
  }

  console.log(
    `\nFound ${stores.length} stores, ${products.length} products.\n`
  );

  // Fixed popularity weight per product (1-5), seeded by index so it's
  // consistent across re-runs rather than fully random each time.
  const productWeights = products.map((_, i) => 1 + (i % 5));

  // 3. Generate per store, per day
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalOrders = 0;
  let totalItems = 0;
  let totalEvents = 0;

  for (const store of stores) {
    console.log(`Generating history for ${store.name} (${store.city})...`);

    // Pick 3-5 random spike days for this store, from the last 30 days
    const spikeDayCount = randInt(3, 5);
    const spikeDays = new Set<number>();
    while (spikeDays.size < spikeDayCount) {
      spikeDays.add(randInt(0, DAYS_OF_HISTORY - 1));
    }

    let storeOrders = 0;
    let storeItems = 0;
    let storeEvents = 0;

    for (let dayOffset = DAYS_OF_HISTORY - 1; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(today);
      dayDate.setDate(dayDate.getDate() - dayOffset);
      const weekday = dayDate.getDay();
      const weekendMult = WEEKEND_MULTIPLIER[weekday] ?? 1.0;
      const isSpike = spikeDays.has(dayOffset);
      const spikeMult = isSpike ? rand(2.5, 4.0) : 1.0;

      for (let hour = 0; hour < 24; hour++) {
        const baseWeight = HOURLY_WEIGHTS[hour];
        const expectedOrders =
          (baseWeight / 10) *
          BASE_ORDERS_PER_HOUR_PEAK *
          weekendMult *
          spikeMult;

        // Poisson-ish: round with jitter so it's not perfectly deterministic
        const orderCount = Math.max(
          0,
          Math.round(expectedOrders + rand(-0.5, 0.5))
        );

        for (let o = 0; o < orderCount; o++) {
          const placedAt = new Date(dayDate);
          placedAt.setHours(hour, randInt(0, 59), randInt(0, 59), 0);

          const completedAt = new Date(placedAt);
          completedAt.setMinutes(
            completedAt.getMinutes() + randInt(15, 45)
          );

          // Pick 1-4 products for this order, weighted by popularity
          const itemCount = randInt(1, 4);
          const chosenProducts = new Set<string>();
          const orderItemsData: {
            productId: string;
            quantity: number;
            unitPrice: number;
            subtotal: number;
          }[] = [];

          for (let i = 0; i < itemCount; i++) {
            const product = pickWeighted(products, productWeights);
            if (chosenProducts.has(product.id)) continue;
            chosenProducts.add(product.id);

            const quantity = randInt(1, 3);
            const unitPrice = product.basePrice;
            const subtotal = Math.round(unitPrice * quantity * 100) / 100;

            orderItemsData.push({
              productId: product.id,
              quantity,
              unitPrice,
              subtotal,
            });
          }

          if (orderItemsData.length === 0) continue;

          const totalAmount = Math.round(
            orderItemsData.reduce((sum, it) => sum + it.subtotal, 0) * 100
          ) / 100;
          const deliveryFee = 20;

          const createdOrder = await prisma.order.create({
            data: {
              externalId: `${SYNTHETIC_PREFIX}${store.id}-${dayOffset}-${hour}-${o}-${Date.now()}-${randInt(1000, 9999)}`,
              status: OrderStatus.DELIVERED,
              totalAmount: totalAmount + deliveryFee,
              deliveryFee,
              placedAt,
              completedAt,
              storeId: store.id,
              items: {
                create: orderItemsData,
              },
            },
          });

          storeOrders += 1;
          storeItems += orderItemsData.length;

          // One DemandEvent per product in the order
          await prisma.demandEvent.createMany({
            data: orderItemsData.map((it) => ({
              eventType: "order_placed",
              payload: {
                productId: it.productId,
                quantity: it.quantity,
                orderId: createdOrder.id,
                synthetic: true,
              },
              recordedAt: placedAt,
              storeId: store.id,
            })),
          });
          storeEvents += orderItemsData.length;
        }
      }
    }

    console.log(
      `  -> ${storeOrders} orders, ${storeItems} order items, ${storeEvents} demand events` +
        ` (spike days: ${[...spikeDays].sort((a, b) => a - b).join(", ")})`
    );

    totalOrders += storeOrders;
    totalItems += storeItems;
    totalEvents += storeEvents;
  }

  console.log("\n=== Done ===");
  console.log(`Total orders:        ${totalOrders}`);
  console.log(`Total order items:   ${totalItems}`);
  console.log(`Total demand events: ${totalEvents}`);
  console.log(`Date range: last ${DAYS_OF_HISTORY} days ending ${today.toDateString()}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });