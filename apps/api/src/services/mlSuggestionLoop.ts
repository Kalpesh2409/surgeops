/**
 * mlSuggestionLoop.ts — SurgeOps Session 14
 *
 * Scheduled loop that periodically re-runs the ML pricing suggestion batch
 * (generateMlPricingSuggestions) so the dashboard's ML comparison panel has
 * fresh random_forest_v1 PricingSuggestion rows to display alongside the
 * rules-engine's surge_engine_v1 rows.
 *
 * Mirrors the start/stop pattern used by demandIngestionLoop.ts.
 * Runs independently — does NOT touch Inventory.currentPrice or the
 * rules-based pricingEngine.ts pipeline. ML suggestions remain a separate,
 * advisory signal (model: "random_forest_v1") for comparison purposes only.
 */

import { generateMlPricingSuggestions } from "./mlPricingSuggester";

let loopTimer: ReturnType<typeof setInterval> | null = null;

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

async function tick(): Promise<void> {
  try {
    console.log("[MlLoop] Running ML pricing suggestion batch...");
    const result = await generateMlPricingSuggestions();
    console.log(
      `[MlLoop] Batch complete — total=${result.total} written=${result.written} errors=${result.errors}`,
    );
  } catch (err) {
    console.error("[MlLoop] Tick error:", err);
  }
}

export function startMlSuggestionLoop(): void {
  if (loopTimer) {
    console.warn("[MlLoop] Already running");
    return;
  }
  console.log(
    `[MlLoop] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`,
  );
  tick();
  loopTimer = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopMlSuggestionLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    console.log("[MlLoop] Stopped");
  }
}