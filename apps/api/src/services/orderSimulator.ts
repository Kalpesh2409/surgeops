/**
 * orderSimulator.ts
 * Core simulation engine: generates realistic fake orders per store,
 * writes Orders + OrderItems + DemandEvents to the database.
 */

import { PrismaClient, OrderStatus } from "@prisma/client";
import {
  getCurrentISTHour,
  getDemandMultiplier,
  getDemandLabel,
  BASE_ORDERS_PER_MINUTE,
  MAX_ITEMS_PER_ORDER,
  CATEGORY_DEMAND_WEIGHTS,
  SURGE_THRESHOLD_MULTIPLIER,
  weightedRandom,
  jitter,
  type DemandEventType,
} from "./simulatorPatterns";

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimulatorState {
  isRunning: boolean;
  intervalHandle: ReturnType<typeof setInterval> | null;
  intervalMs: number;
  ordersThisMinute: number;
  minuteWindowStart: number;
  totalOrdersGenerated: number;
  totalDemandEventsWritten: number;
  lastRunAt: Date | null;
  errors: string[];
}

interface ProductWithInventory {
  id: string;
  name: string;
  basePrice: number;
  categorySlug: string;
  inventory: {
    id: string;
    quantity: number;
  };
}

interface SimulateOrdersForStoreResult {
  storeId: string;
  ordersCreated: number;
  demandEventsWritten: number;
  skipped: boolean;
  reason?: string;
}

// ─── Singleton State ──────────────────────────────────────────────────────────

const state: SimulatorState = {
  isRunning: false,
  intervalHandle: null,
  intervalMs: 30_000, // tick every 30 seconds
  ordersThisMinute: 0,
  minuteWindowStart: Date.now(),
  totalOrdersGenerated: 0,
  totalDemandEventsWritten: 0,
  lastRunAt: null,
  errors: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logError(msg: string): void {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  console.error("[Simulator]", msg);
  state.errors = [entry, ...state.errors].slice(0, 20); // keep last 20
}

function resetMinuteWindow(): void {
  const now = Date.now();
  if (now - state.minuteWindowStart >= 60_000) {
    state.ordersThisMinute = 0;
    state.minuteWindowStart = now;
  }
}

/**
 * Decide how many orders to create for this tick, for one store.
 * Formula: BASE_ORDERS_PER_MINUTE × multiplier × (intervalMs/60000) ± jitter
 */
function ordersForTick(multiplier: number): number {
  const base =
    BASE_ORDERS_PER_MINUTE * multiplier * (state.intervalMs / 60_000);
  const jittered = jitter(base, 0.3);
  return Math.max(0, Math.round(jittered));
}

/**
 * Fetch all stores with their in-stock products and inventory.
 */
async function fetchStoresWithProducts(): Promise<
  Array<{
    id: string;
    name: string;
    products: ProductWithInventory[];
  }>
> {
  const stores = await prisma.store.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      inventory: {
        where: {
          quantityOnHand: { gt: 0 },
        },
        select: {
          id: true,
          quantityOnHand: true,
          product: {
            select: {
              id: true,
              name: true,
              basePrice: true,
              category: {
                select: { slug: true },
              },
            },
          },
        },
      },
    },
  });

  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    products: store.inventory.map((inv) => ({
      id: inv.product.id,
      name: inv.product.name,
      basePrice: Number(inv.product.basePrice),
      categorySlug: inv.product.category.slug,
      inventory: {
        id: inv.id,
        quantity: inv.quantityOnHand,
      },
    })),
  }));
}

/**
 * Pick 1–MAX_ITEMS products for an order, weighted by category demand.
 */
function pickOrderItems(
  products: ProductWithInventory[],
  count: number,
): Array<{ product: ProductWithInventory; quantity: number }> {
  if (products.length === 0) return [];

  // Build weights per product based on category
  const weights = products.map((p) => {
    const slug = p.categorySlug.toLowerCase();
    return CATEGORY_DEMAND_WEIGHTS[slug] ?? CATEGORY_DEMAND_WEIGHTS["default"];
  });

  const itemCount = Math.min(count, products.length, MAX_ITEMS_PER_ORDER);
  const picked: Array<{ product: ProductWithInventory; quantity: number }> = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < itemCount; i++) {
    // Filter out already-picked products
    const available = products.filter((p) => !usedIds.has(p.id));
    const availableWeights = weights.filter(
      (_, idx) => !usedIds.has(products[idx].id),
    );

    if (available.length === 0) break;

    const product = weightedRandom(available, availableWeights);
    usedIds.add(product.id);

    // Quantity: mostly 1–3 units
    const qty = Math.floor(Math.random() * 3) + 1;
    picked.push({ product, quantity: qty });
  }

  return picked;
}

// ─── Core: Simulate orders for a single store ─────────────────────────────────

async function simulateOrdersForStore(
  store: { id: string; name: string; products: ProductWithInventory[] },
  multiplier: number,
  demandLabel: string,
  orderCount: number,
): Promise<SimulateOrdersForStoreResult> {
  if (store.products.length === 0) {
    return {
      storeId: store.id,
      ordersCreated: 0,
      demandEventsWritten: 0,
      skipped: true,
      reason: "no_stock",
    };
  }

  if (orderCount === 0) {
    return {
      storeId: store.id,
      ordersCreated: 0,
      demandEventsWritten: 0,
      skipped: true,
      reason: "zero_demand",
    };
  }

  let ordersCreated = 0;
  let demandEventsWritten = 0;

  for (let i = 0; i < orderCount; i++) {
    try {
      // Pick 1–3 items per order
      const itemCount = Math.floor(Math.random() * 3) + 1;
      const pickedItems = pickOrderItems(store.products, itemCount);

      if (pickedItems.length === 0) continue;

      // Calculate totals
      const orderItems = pickedItems.map(({ product, quantity }) => ({
        product: {
          connect: { id: product.id },
        },
        quantity,
        unitPrice: product.basePrice,
        subtotal: product.basePrice * quantity,
      }));

      const totalAmount = orderItems.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );

      // Write Order + OrderItems in a transaction
      const order = await prisma.order.create({
        data: {
          storeId: store.id,
          status: OrderStatus.DELIVERED, // simulated orders are instant
          totalAmount,
          items: {
            create: orderItems,
          },
        },
        include: { items: true },
      });

      ordersCreated++;
      state.totalOrdersGenerated++;
      state.ordersThisMinute++;

      // Write a DemandEvent per order
      await prisma.demandEvent.create({
        data: {
          storeId: store.id,
          eventType: "ORDER_PLACED",
          payload: {
            orderId: order.id,
            productId: pickedItems[0].product.id,
            demandLabel,
            multiplier,
            itemCount: pickedItems.length,
            products: pickedItems.map((i) => ({
              productId: i.product.id,
              name: i.product.name,
              quantity: i.quantity,
            })),
          },
        },
      });

      demandEventsWritten++;
      state.totalDemandEventsWritten++;

      // Check if we should emit a SURGE_DETECTED event
      await prisma.demandEvent.create({
        data: {
          storeId: store.id,
          eventType: "SURGE_DETECTED",
          payload: {
            productId: pickedItems[0].product.id,
            multiplier,
            demandLabel,
            ordersThisMinute: state.ordersThisMinute,
            threshold: SURGE_THRESHOLD_MULTIPLIER,
          },
        },
      });
      demandEventsWritten++;
      state.totalDemandEventsWritten++;
    } catch (err) {
      logError(
        `Failed to simulate order for store ${store.id}: ${String(err)}`,
      );
    }
  }

  return {
    storeId: store.id,
    ordersCreated,
    demandEventsWritten,
    skipped: false,
  };
}

// ─── Main Tick ────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  resetMinuteWindow();

  const istHour = getCurrentISTHour();
  const multiplier = getDemandMultiplier(istHour);
  const demandLabel = getDemandLabel(istHour);

  state.lastRunAt = new Date();

  let stores: Awaited<ReturnType<typeof fetchStoresWithProducts>>;
  try {
    stores = await fetchStoresWithProducts();
  } catch (err) {
    logError(`Failed to fetch stores: ${String(err)}`);
    return;
  }

  console.log(
    `[Simulator] Tick — IST hour: ${istHour} | label: ${demandLabel} | multiplier: ${multiplier.toFixed(2)} | stores: ${stores.length}`,
  );

  const results = await Promise.all(
    stores.map((store) => {
      const orderCount = ordersForTick(multiplier);
      return simulateOrdersForStore(store, multiplier, demandLabel, orderCount);
    }),
  );

  const totalOrders = results.reduce((s, r) => s + r.ordersCreated, 0);
  const totalEvents = results.reduce((s, r) => s + r.demandEventsWritten, 0);

  console.log(
    `[Simulator] Tick done — orders created: ${totalOrders} | demand events: ${totalEvents}`,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startSimulator(intervalMs?: number): void {
  if (state.isRunning) {
    console.log("[Simulator] Already running.");
    return;
  }

  if (intervalMs) state.intervalMs = intervalMs;

  console.log(`[Simulator] Starting — tick every ${state.intervalMs / 1000}s`);
  state.isRunning = true;

  // Run immediately on start, then on interval
  tick().catch((err) => logError(`Initial tick failed: ${String(err)}`));
  state.intervalHandle = setInterval(() => {
    tick().catch((err) => logError(`Tick failed: ${String(err)}`));
  }, state.intervalMs);
}

export function stopSimulator(): void {
  if (!state.isRunning) return;
  if (state.intervalHandle) clearInterval(state.intervalHandle);
  state.isRunning = false;
  state.intervalHandle = null;
  console.log("[Simulator] Stopped.");
}

export function getSimulatorStatus() {
  return {
    isRunning: state.isRunning,
    intervalMs: state.intervalMs,
    totalOrdersGenerated: state.totalOrdersGenerated,
    totalDemandEventsWritten: state.totalDemandEventsWritten,
    lastRunAt: state.lastRunAt,
    recentErrors: state.errors,
    currentDemand: {
      istHour: getCurrentISTHour(),
      multiplier: getDemandMultiplier(getCurrentISTHour()),
      label: getDemandLabel(getCurrentISTHour()),
    },
  };
}

/**
 * manualInject: run a single tick with an optional surge override.
 * Used by POST /simulator/inject.
 */
export async function manualInject(options?: {
  storeId?: string;
  surgeMultiplier?: number;
  orderCount?: number;
}): Promise<{
  ordersCreated: number;
  demandEventsWritten: number;
  storeResults: SimulateOrdersForStoreResult[];
}> {
  const istHour = getCurrentISTHour();
  const multiplier = options?.surgeMultiplier ?? getDemandMultiplier(istHour);
  const demandLabel = options?.surgeMultiplier
    ? "manual_surge"
    : getDemandLabel(istHour);

  let stores = await fetchStoresWithProducts();

  // Filter to a specific store if requested
  if (options?.storeId) {
    stores = stores.filter((s) => s.id === options.storeId);
  }

  const storeResults = await Promise.all(
    stores.map((store) => {
      const count = options?.orderCount ?? ordersForTick(multiplier);
      return simulateOrdersForStore(store, multiplier, demandLabel, count);
    }),
  );

  return {
    ordersCreated: storeResults.reduce((s, r) => s + r.ordersCreated, 0),
    demandEventsWritten: storeResults.reduce(
      (s, r) => s + r.demandEventsWritten,
      0,
    ),
    storeResults,
  };
}
