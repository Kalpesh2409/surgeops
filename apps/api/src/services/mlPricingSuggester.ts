/**
 * mlPricingSuggester.ts - SurgeOps Session 15 (baseline-ratio update)
 *
 * Calls the Python ML service's /predict endpoint for each store×product,
 * converts predicted demand into a suggested price via a continuous
 * baseline-ratio formula (replacing the old fixed DEMAND_BANDS lookup),
 * applies PricingRule guardrails, and writes to PricingSuggestion.
 *
 * demand_ratio (from /predict) expresses predicted demand relative to that
 * specific store+product's own historical average — a ratio of 1.0 means
 * "exactly normal demand for this item", not a fixed universal threshold.
 * This makes the multiplier scale correctly whether a product normally
 * sells 2 units/day or 20 units/day.
 *
 * This is a separate suggestion source from pricingEngine.ts (rules-based).
 * Both write to PricingSuggestion, distinguished by the `model` field.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * Continuous multiplier formula, replacing the old fixed DEMAND_BANDS.
 *
 * multiplier = 1.0 + SENSITIVITY * (demand_ratio - 1)
 *
 * At ratio=1.0 (normal demand): multiplier = 1.0x (no change)
 * At ratio=2.0 (double normal demand): multiplier = 1.5x (matches old ceiling)
 * At low ratios (below-normal demand): multiplier drops below 1.0x, allowing
 * real ML-justified discounts, floored at MIN_MULTIPLIER so discounts stay
 * bounded and don't risk selling below a healthy margin.
 */
const SENSITIVITY = 0.5;
const MIN_MULTIPLIER = 0.85;
const MAX_MULTIPLIER = 1.5;

function demandRatioToMultiplier(demandRatio: number): number {
  const raw = 1.0 + SENSITIVITY * (demandRatio - 1.0);
  return Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, raw));
}

interface MlPredictResponse {
  store_id: string;
  product_id: string;
  predicted_demand: number;
  demand_ratio: number;
  confidence: number;
  hour_of_day: number;
  day_of_week: number;
  model: string;
}

async function callPredict(
  storeId: string,
  productId: string,
  basePrice: number,
): Promise<MlPredictResponse> {
  const res = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      product_id: productId,
      base_price: basePrice,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ML predict failed (${res.status}): ${errText}`);
  }

  return res.json() as Promise<MlPredictResponse>;
}

export async function generateMlPricingSuggestions(): Promise<{
  total: number;
  written: number;
  errors: number;
}> {
  const inventoryRows = await prisma.inventory.findMany({
    include: { product: true },
  });

  let written = 0;
  let errors = 0;

  for (const inv of inventoryRows) {
    try {
      const prediction = await callPredict(
        inv.storeId,
        inv.productId,
        inv.product.basePrice,
      );

      const multiplier = demandRatioToMultiplier(prediction.demand_ratio);

      const rule = await prisma.pricingRule.findUnique({
        where: {
          storeId_productId: { storeId: inv.storeId, productId: inv.productId },
        },
      });

      let suggestedPrice = parseFloat(
        (inv.product.basePrice * multiplier).toFixed(2),
      );

      if (rule && rule.isActive) {
        suggestedPrice = Math.max(
          rule.floorPrice,
          Math.min(rule.ceilPrice, suggestedPrice),
        );
      }

      const confidence = prediction.confidence;

      await prisma.pricingSuggestion.create({
        data: {
          storeId: inv.storeId,
          productId: inv.productId,
          suggestedPrice,
          confidence,
          model: prediction.model,
        },
      });

      written++;
    } catch (err) {
      console.error(
        `Failed ML suggestion for ${inv.storeId}/${inv.productId}:`,
        err,
      );
      errors++;
    }
  }

  return { total: inventoryRows.length, written, errors };
}