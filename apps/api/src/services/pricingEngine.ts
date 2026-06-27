/**
 * pricingEngine.ts — SurgeOps Session 5
 *
 * Reads recent DemandEvents for a store+product, computes a surge multiplier
 * bounded by the PricingRule guardrails, and returns a suggested price.
 *
 * No paid APIs — pure rules-based logic.
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
};

/** Demand score → multiplier curve breakpoints */
const SURGE_THRESHOLDS = [
  { minScore: 0, multiplier: 1.0 },
  { minScore: 3, multiplier: 1.1 },
  { minScore: 6, multiplier: 1.2 },
  { minScore: 10, multiplier: 1.35 },
  { minScore: 15, multiplier: 1.5 },
  { minScore: 20, multiplier: 1.75 },
  { minScore: 30, multiplier: 2.0 },
];

// ── Core engine ───────────────────────────────────────────────────────────────

/**
 * Compute demand score from recent events.
 * Events closer in time get a time-decay weight (half-life = 15 min).
 */
function computeDemandScore(
  events: Array<{ eventType: string; recordedAt: Date; payload: Prisma.JsonValue }>
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
      typeof payload?.magnitude === "number" ? (payload.magnitude as number) : 1.0;

    return score + baseWeight * decayFactor * magnitude;
  }, 0);
}

/**
 * Map demand score → raw surge multiplier (step function, no extrapolation).
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
function computeConfidence(
  eventCount: number,
  demandScore: number
): number {
  // More events + higher score = more confident
  const eventFactor = Math.min(eventCount / 10, 1.0); // saturates at 10 events
  const scoreFactor = Math.min(demandScore / 20, 1.0); // saturates at score 20
  return parseFloat(((eventFactor * 0.5 + scoreFactor * 0.5) * 0.95 + 0.05).toFixed(4));
}

/**
 * Main pricing engine entry point.
 */
export async function computeSuggestedPrice(
  input: PricingInput
): Promise<PricingResult> {
  const { storeId, productId } = input;

  // 1. Load inventory (current price + product base price)
  const inventory = await prisma.inventory.findUnique({
    where: { storeId_productId: { storeId, productId } },
    include: { product: true },
  });

  if (!inventory) {
    throw new Error(
      `Inventory not found for storeId=${storeId} productId=${productId}`
    );
  }

  const basePrice = inventory.product.basePrice;
  const currentPrice = inventory.currentPrice;

  // 2. Load pricing rule (optional — may not exist for every store×product)
  const rule = await prisma.pricingRule.findUnique({
    where: { storeId_productId: { storeId, productId } },
  });

  // 3. Fetch recent demand events
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  const events = await prisma.demandEvent.findMany({
    where: {
      storeId,
      payload: {
        path: ["productId"],
        equals: productId,
      },
      recordedAt: { gte: since },
    },
    orderBy: { recordedAt: "desc" },
    take: 100,
  });

  // 4. Compute demand score + raw multiplier
  const demandScore = computeDemandScore(events);
  let rawMultiplier = scoreToMultiplier(demandScore);

  // 5. Apply rule guardrails
  let suggestedPrice: number;
  let reasoning: string;

  if (rule && rule.isActive) {
    // Cap multiplier at rule's surgeMultiplierMax
    const cappedMultiplier = Math.min(rawMultiplier, rule.surgeMultiplierMax);
    const unclamped = parseFloat((basePrice * cappedMultiplier).toFixed(2));
    // Clamp to [floorPrice, ceilPrice]
    suggestedPrice = Math.max(rule.floorPrice, Math.min(rule.ceilPrice, unclamped));
    rawMultiplier = cappedMultiplier;
    reasoning = `demandScore=${demandScore.toFixed(2)}, multiplier=${cappedMultiplier.toFixed(2)}x, clamped to [₹${rule.floorPrice}–₹${rule.ceilPrice}], events=${events.length}`;
  } else {
    // No rule — apply a conservative default cap of 1.5x
    const defaultCap = 1.5;
    rawMultiplier = Math.min(rawMultiplier, defaultCap);
    suggestedPrice = parseFloat((basePrice * rawMultiplier).toFixed(2));
    reasoning = `demandScore=${demandScore.toFixed(2)}, multiplier=${rawMultiplier.toFixed(2)}x (no rule, default cap ${defaultCap}x), events=${events.length}`;
  }

  const confidence = computeConfidence(events.length, demandScore);

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
  };
}