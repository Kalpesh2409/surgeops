/**
 * demandIngestionLoop.ts — SurgeOps Session 5
 *
 * Background service that scans for new DemandEvents every 15 seconds.
 * For each unique store×product pair seen in recent events, it:
 *   1. Calls pricingEngine.computeSuggestedPrice()
 *   2. Calls priceUpdateWriter.writePriceUpdate()
 *
 * Tracks a high-water mark (lastProcessedAt) per run to avoid
 * reprocessing old events. No message queue — simple polling loop.
 */

import { PrismaClient } from "@prisma/client";
import { computeSuggestedPrice } from "./pricingEngine";
import { writePriceUpdate } from "./priceUpdateWriter";

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = 15_000;

// High-water mark — events older than this have already been processed
let lastProcessedAt: Date = new Date(Date.now() - POLL_INTERVAL_MS);

let loopTimer: NodeJS.Timeout | null = null;
let isRunning = false;
let isProcessing = false;

// ── Stats (exposed via /pricing routes) ──────────────────────────────────────

export interface IngestionStats {
  isRunning: boolean;
  lastRunAt: Date | null;
  totalRuns: number;
  totalEventsProcessed: number;
  totalPriceUpdates: number;
  lastError: string | null;
}

const stats: IngestionStats = {
  isRunning: false,
  lastRunAt: null,
  totalRuns: 0,
  totalEventsProcessed: 0,
  totalPriceUpdates: 0,
  lastError: null,
};

// ── Core tick ─────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  if (isProcessing) {
    console.log("[DemandIngestion] Skipping tick — previous run still in progress");
    return;
  }

  isProcessing = true;
  const tickStart = new Date();

  try {
    // Fetch events newer than our high-water mark
    const newEvents = await prisma.demandEvent.findMany({
      where: { recordedAt: { gt: lastProcessedAt } },
      orderBy: { recordedAt: "asc" },
      select: {
        storeId: true,
        payload: true,
        recordedAt: true,
      },
    });

    if (newEvents.length === 0) {
      stats.lastRunAt = tickStart;
      stats.totalRuns++;
      return;
    }

    console.log(
      `[DemandIngestion] ${newEvents.length} new event(s) since ${lastProcessedAt.toISOString()}`
    );

    // Deduplicate to unique store×product pairs
    const pairs = new Map<string, { storeId: string; productId: string }>();

    for (const event of newEvents) {
      const payload = event.payload as Record<string, unknown>;
      const productId =
        typeof payload?.productId === "string" ? payload.productId : null;

      if (!productId) continue;

      const key = `${event.storeId}::${productId}`;
      if (!pairs.has(key)) {
        pairs.set(key, { storeId: event.storeId, productId });
      }
    }

    console.log(
      `[DemandIngestion] Unique store×product pairs to price: ${pairs.size}`
    );

    // Run pricing engine for each pair (sequentially to avoid DB contention)
    let updatesThisTick = 0;

    for (const [, { storeId, productId }] of pairs) {
      try {
        const pricingResult = await computeSuggestedPrice({ storeId, productId });
        const writeResult = await writePriceUpdate(pricingResult);

        if (writeResult.priceChanged) {
          updatesThisTick++;
          console.log(
            `[DemandIngestion] Price updated — store=${storeId.slice(0, 8)} ` +
              `product=${productId.slice(0, 8)} ` +
              `₹${writeResult.previousPrice.toFixed(2)} → ₹${writeResult.newPrice.toFixed(2)} ` +
              `(${pricingResult.surgeMultiplier.toFixed(2)}x, conf=${pricingResult.confidence.toFixed(2)})`
          );
        }
      } catch (err) {
        // Non-fatal: log and continue with remaining pairs
        console.warn(
          `[DemandIngestion] Failed to price storeId=${storeId} productId=${productId}:`,
          (err as Error).message
        );
      }
    }

    // Advance high-water mark to the latest event we've seen
    const latest = newEvents[newEvents.length - 1];
    lastProcessedAt = latest.recordedAt;

    // Update stats
    stats.totalEventsProcessed += newEvents.length;
    stats.totalPriceUpdates += updatesThisTick;
    stats.lastRunAt = tickStart;
    stats.totalRuns++;
    stats.lastError = null;
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[DemandIngestion] Tick error:", msg);
    stats.lastError = msg;
  } finally {
    isProcessing = false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startDemandIngestionLoop(): void {
  if (isRunning) {
    console.log("[DemandIngestion] Already running");
    return;
  }

  isRunning = true;
  stats.isRunning = true;
  console.log(
    `[DemandIngestion] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`
  );

  // Run immediately on start, then on interval
  void tick();
  loopTimer = setInterval(() => void tick(), POLL_INTERVAL_MS);
}

export function stopDemandIngestionLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  isRunning = false;
  stats.isRunning = false;
  console.log("[DemandIngestion] Stopped");
}

export function getDemandIngestionStats(): IngestionStats {
  return { ...stats };
}

/** Force an immediate tick (used by POST /pricing/recalculate) */
export async function triggerImmediateTick(): Promise<void> {
  await tick();
}