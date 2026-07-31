/**
 * explanationBuilder.ts — Session 27+ replacement for the Gemini AI
 * explanation feature.
 *
 * Builds a short, human-readable sentence describing why a product's
 * price is what it is right now — using simple, fixed rules based on
 * numbers already available (no AI call, no rate limit, no staleness).
 *
 * WHY THIS REPLACED GEMINI: the Gemini-based explanation caused a long
 * chain of real bugs in one session — text describing an old price after
 * the price moved on, a reason that didn't match after a status flipped
 * (e.g. "low confidence" shown after a product became MRP-capped), and
 * delays from a shared 1-call-per-15-second rate limit across 18
 * products. Meanwhile, most of what it said just repeated the
 * Reason/Confidence columns already visible on the dashboard. This
 * version is instant, always accurate (since it's computed from the same
 * numbers on screen), and needs no external API, cache, or budget.
 */

export interface ExplanationInput {
  productName: string;
  basePrice: number;
  currentPrice: number;
  cappedAtMrp: boolean;
  confidence: number; // 0–1
}

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const PRICE_EQUAL_EPSILON = 0.01; // ₹ — treat anything closer than this as "unchanged"

export function buildExplanation(input: ExplanationInput): string {
  const { productName, basePrice, currentPrice, cappedAtMrp, confidence } = input;

  // MRP cap always takes priority — it's the most informative, legally
  // grounded reason, and it's never ambiguous.
  if (cappedAtMrp) {
    return `Capped at ₹${currentPrice.toFixed(2)} — demand pushed it higher, but MRP can never be exceeded.`;
  }

  const delta = currentPrice - basePrice;

  if (Math.abs(delta) < PRICE_EQUAL_EPSILON) {
    return confidence < LOW_CONFIDENCE_THRESHOLD
      ? `System isn't confident enough to change ${productName}'s price right now.`
      : `${productName}'s price is steady — demand looks normal.`;
  }

  if (delta > 0) {
    return `Price raised to ₹${currentPrice.toFixed(2)} due to high demand.`;
  }

  return `Price lowered to ₹${currentPrice.toFixed(2)} to encourage sales.`;
}