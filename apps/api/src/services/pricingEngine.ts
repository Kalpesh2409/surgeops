/**
 * pricingEngine.ts — SurgeOps Session 15
 *
 * Baseline demand price now comes from the trained ML model (latest
 * random_forest_v1 PricingSuggestion row). Live DemandEvents no longer
 * compute the price from scratch — instead they compute a real-time surge
 * ADJUSTMENT that is applied on top of the ML baseline. This preserves the
 * live-reactivity demo (Traffic Simulator / DDoS injects) while making the
 * ML model the source of truth for "expected" demand.
 *
 * Falls back to pure rules-based scoring (Session 5 behavior) if no ML
 * suggestion exists yet for a given store+product.
 *
 * GUARDRAIL FIX (Session 15 follow-up): surgeMultiplierMax now caps only the
 * LIVE SURGE ADJUSTMENT portion, not the ML baseline itself. Previously the
 * cap was applied to the combined (ML baseline × surge) multiplier, which
 * meant a high-confidence ML prediction could get silently clipped even with
 * zero live demand events. Now: the ML baseline is trusted as-is (it's a
 * learned pattern, not a reactive spike), live events can only adjust price
 * upward/downward from that baseline within surgeMultiplierMax bounds, and
 * floorPrice/ceilPrice still apply as the absolute final safety net on the
 * resulting price regardless of source.
 *
 * MRP CAP (Session 27): added a final, absolute, non-negotiable price ceiling
 * based on each product's real-world Indian MRP (Maximum Retail Price).
 * Unlike floorPrice/ceilPrice (business guardrails we set ourselves), MRP is
 * a legal constraint — the final price can NEVER exceed it, regardless of
 * what the ML baseline, surge adjustment, or rule guardrails decided. This
 * check happens last, after everything else. The surgeMultiplier value is
 * NOT recalculated after capping — it still reflects the true underlying
 * demand signal, even when the final ₹ price couldn't fully express it.
 *
 * No paid APIs — pure rules-based + locally trained ML logic.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PricingInput {
  storeId: string;
  productId: string;
}

export interface PricingResult {
  storeId: string;
  productId: string;
  basePrice: number;
  currentPrice: number;
  suggestedPrice: number;
  surgeMultiplier: number;
  confidence: number;
  reasoning: string;
  hasRule: boolean;
  usedMlBaseline: boolean;
  cappedAtMrp: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Look-back window for demand events (minutes) */
const LOOKBACK_MINUTES = 30;

/** Event type weights for demand score */
const EVENT_WEIGHTS: Record<string, number> = {
  order_placed: 1.0,
  surge_start: 2.5,
  stock_low: 1.8,
  surge_end: -1.5,
  SURGE_INJECT: 3.0,
};

/**
 * Demand score → surge ADJUSTMENT FACTOR curve breakpoints.
 * At score 0 this returns 1.0 (i.e. no adjustment to the ML baseline).
 * This curve is unchanged from Session 5 — it's just reinterpreted now as
 * an adjustment on top of the ML baseline rather than a standalone multiplier.
 */
const SURGE_THRESHOLDS = [
  { minScore: 0, multiplier: 1.0 },
  { minScore: 3, multiplier: 1.1 },
  { minScore: 6, multiplier: 1.2 },
  { minScore: 10, multiplier: 1.35 },
  { minScore: 15, multiplier: 1.5 },
  { minScore: 20, multiplier: 1.75 },
  { minScore: 30, multiplier: 2.0 },
];

/** Which PricingSuggestion.model value counts as the ML baseline source */
const ML_MODEL_NAME = "random_forest_v1";

// ── Core engine ───────────────────────────────────────────────────────────────

/**
 * Compute demand score from recent events.
 * Events closer in time get a time-decay weight (half-life = 15 min).
 */
function computeDemandScore(
  events: Array<{
    eventType: string;
    recordedAt: Date;
    payload: Prisma.JsonValue;
  }>,
): number {
  const now = Date.now();
  const halfLifeMs = 15 * 60 * 1000;

  return events.reduce((score, event) => {
    const ageMs = now - event.recordedAt.getTime();
    const decayFactor = Math.pow(0.5, ageMs / halfLifeMs);
    const baseWeight = EVENT_WEIGHTS[event.eventType] ?? 0.5;

    // Extra boost if payload carries an explicit magnitude
    const payload = event.payload as Record<string, unknown>;
    const magnitude =
      typeof payload?.magnitude === "number"
        ? (payload.magnitude as number)
        : 1.0;

    return score + baseWeight * decayFactor * magnitude;
  }, 0);
}

/**
 * Map demand score → surge adjustment factor (step function, no extrapolation).
 * Returns 1.0 at score 0, meaning "no change to the ML baseline".
 */
function scoreToMultiplier(score: number): number {
  let multiplier = 1.0;
  for (const band of SURGE_THRESHOLDS) {
    if (score >= band.minScore) multiplier = band.multiplier;
    else break;
  }
  return multiplier;
}

/**
 * Derive a 0–1 confidence value from how many events and their freshness.
 */
function computeConfidence(eventCount: number, demandScore: number): number {
  // More events + higher score = more confident
  const eventFactor = Math.min(eventCount / 10, 1.0); // saturates at 10 events
  const scoreFactor = Math.min(demandScore / 20, 1.0); // saturates at score 20
  return parseFloat(
    ((eventFactor * 0.5 + scoreFactor * 0.5) * 0.95 + 0.05).toFixed(4),
  );
}

/**
 * Fetch the most recent ML-generated PricingSuggestion (random_forest_v1)
 * for a given store+product. Returns null if none exists yet — callers
 * must fall back to rules-only behavior in that case.
 */
async function getLatestMlBaseline(
  storeId: string,
  productId: string,
): Promise<{ suggestedPrice: number; confidence: number } | null> {
  const row = await prisma.pricingSuggestion.findFirst({
    where: { storeId, productId, model: ML_MODEL_NAME },
    orderBy: { createdAt: "desc" },
  });

  return row
    ? { suggestedPrice: row.suggestedPrice, confidence: row.confidence }
    : null;
}

/**
 * Main pricing engine entry point.
 */
export async function computeSuggestedPrice(
  input: PricingInput,
): Promise<PricingResult> {
  const { storeId, productId } = input;

  // 1. Load inventory (current price + product base price + MRP)
  const inventory = await prisma.inventory.findUnique({
    where: { storeId_productId: { storeId, productId } },
    include: { product: true },
  });

  if (!inventory) {
    throw new Error(
      `Inventory not found for storeId=${storeId} productId=${productId}`,
    );
  }

  const basePrice = inventory.product.basePrice;
  const currentPrice = inventory.currentPrice;
  const mrp = inventory.product.mrp;

  // 2. Load pricing rule (optional — may not exist for every store×product)
  const rule = await prisma.pricingRule.findUnique({
    where: { storeId_productId: { storeId, productId } },
  });

  // 3. Fetch recent demand events for this store, then filter in-memory.
  // A DemandEvent applies to this product if its payload.productId matches,
  // OR if the event has no productId at all (store-wide injects like the
  // Traffic Simulator's "+100/+500/+1000 Users" and DDoS buttons, which are
  // meant to affect every product in the store).
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  const allStoreEvents = await prisma.demandEvent.findMany({
    where: {
      storeId,
      recordedAt: { gte: since },
    },
    orderBy: { recordedAt: "desc" },
    take: 200,
  });

  const events = allStoreEvents.filter((event) => {
    const payload = event.payload as Record<string, unknown> | null;
    const eventProductId = payload?.productId;
    return eventProductId === undefined || eventProductId === productId;
  });

  // 4. Compute ML baseline (if available) + live surge adjustment factor
  const mlBaseline = await getLatestMlBaseline(storeId, productId);
  const demandScore = computeDemandScore(events);
  const surgeAdjustmentFactor = scoreToMultiplier(demandScore);

  const usedMlBaseline = !!mlBaseline && basePrice > 0;
  const mlBaselineMultiplier = usedMlBaseline
    ? mlBaseline!.suggestedPrice / basePrice
    : 1.0;

  // 5. Apply rule guardrails.
  // GUARDRAIL FIX: surgeMultiplierMax now caps ONLY the live surge adjustment
  // factor, never the ML baseline itself. The ML baseline reflects a learned
  // historical pattern, not a reactive spike — it shouldn't be silently
  // clipped by a cap that was designed to bound live event reactivity.
  // floorPrice/ceilPrice still apply afterward as the absolute final safety
  // net on the resulting price, regardless of source.
  let rawMultiplier: number;
  let suggestedPrice: number;
  let reasoning: string;

  if (rule && rule.isActive) {
    const cappedSurgeAdjustment = Math.min(
      surgeAdjustmentFactor,
      rule.surgeMultiplierMax,
    );

    const combinedMultiplier = usedMlBaseline
      ? mlBaselineMultiplier * cappedSurgeAdjustment
      : cappedSurgeAdjustment;

    const unclamped = parseFloat(
      (basePrice * combinedMultiplier).toFixed(2),
    );
    // Clamp to [floorPrice, ceilPrice] — final absolute safety net
    suggestedPrice = Math.max(
      rule.floorPrice,
      Math.min(rule.ceilPrice, unclamped),
    );
    rawMultiplier = combinedMultiplier;

    reasoning = usedMlBaseline
      ? `mlBaseline=₹${mlBaseline!.suggestedPrice.toFixed(2)} (uncapped), demandScore=${demandScore.toFixed(2)}, surgeAdj=${cappedSurgeAdjustment.toFixed(2)}x (capped at ${rule.surgeMultiplierMax}x), multiplier=${combinedMultiplier.toFixed(2)}x, clamped to [₹${rule.floorPrice}–₹${rule.ceilPrice}], events=${events.length}`
      : `[rules-only fallback, no ML data yet] demandScore=${demandScore.toFixed(2)}, multiplier=${combinedMultiplier.toFixed(2)}x (capped at ${rule.surgeMultiplierMax}x), clamped to [₹${rule.floorPrice}–₹${rule.ceilPrice}], events=${events.length}`;
  } else {
    // No rule — apply a conservative default cap of 1.5x to the SURGE
    // ADJUSTMENT only, same principle as above, not to the ML baseline.
    const defaultCap = 1.5;
    const cappedSurgeAdjustment = Math.min(surgeAdjustmentFactor, defaultCap);

    const combinedMultiplier = usedMlBaseline
      ? mlBaselineMultiplier * cappedSurgeAdjustment
      : cappedSurgeAdjustment;

    suggestedPrice = parseFloat((basePrice * combinedMultiplier).toFixed(2));
    rawMultiplier = combinedMultiplier;

    reasoning = usedMlBaseline
      ? `mlBaseline=₹${mlBaseline!.suggestedPrice.toFixed(2)} (uncapped), demandScore=${demandScore.toFixed(2)}, surgeAdj=${cappedSurgeAdjustment.toFixed(2)}x (no rule, default cap ${defaultCap}x), multiplier=${combinedMultiplier.toFixed(2)}x, events=${events.length}`
      : `[rules-only fallback, no ML data yet] demandScore=${demandScore.toFixed(2)}, multiplier=${combinedMultiplier.toFixed(2)}x (no rule, default cap ${defaultCap}x), events=${events.length}`;
  }

  const confidence = computeConfidence(events.length, demandScore);

  // ── MRP cap — the absolute, non-negotiable final check (Session 27) ─────────
  // No matter what the ML baseline, live surge adjustment, or rule guardrails
  // decided, the final price can NEVER exceed the product's legal MRP. This
  // is the very last check, after everything else, on purpose. Note:
  // surgeMultiplier is NOT recalculated here — it still reflects the true
  // demand signal, even when the final ₹ price can't fully express it.
  let cappedAtMrp = false;
  if (mrp > 0 && suggestedPrice > mrp) {
    suggestedPrice = mrp;
    cappedAtMrp = true;
    reasoning += ` | capped at MRP ₹${mrp.toFixed(2)}`;
  }

  return {
    storeId,
    productId,
    basePrice,
    currentPrice,
    suggestedPrice,
    surgeMultiplier: parseFloat(rawMultiplier.toFixed(4)),
    confidence,
    reasoning,
    hasRule: !!rule,
    usedMlBaseline,
    cappedAtMrp,
  };
}