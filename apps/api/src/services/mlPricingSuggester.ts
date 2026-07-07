/**
 * mlPricingSuggester.ts - SurgeOps Session 13
 *
 * Calls the Python ML service's /predict endpoint for each storexproduct,
 * converts predicted demand into a suggested price via a fixed lookup table,
 * applies PricingRule guardrails, and writes to PricingSuggestion.
 *
 * This is a separate suggestion source from pricingEngine.ts (rules-based).
 * Both write to PricingSuggestion, distinguished by the `model` field.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const DEMAND_BANDS = [
  { maxDemand: 2, multiplier: 1.0 },
  { maxDemand: 4, multiplier: 1.1 },
  { maxDemand: 6, multiplier: 1.3 },
  { maxDemand: Infinity, multiplier: 1.5 },
];

function demandToMultiplier(predictedDemand: number): number {
  for (const band of DEMAND_BANDS) {
    if (predictedDemand <= band.maxDemand) return band.multiplier;
  }
  return 1.0;
}

interface MlPredictResponse {
  store_id: string;
  product_id: string;
  predicted_demand: number;
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

      const multiplier = demandToMultiplier(prediction.predicted_demand);

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
