/**
 * priceUpdateWriter.ts — SurgeOps Session 5
 *
 * Writes the output of pricingEngine into:
 *   1. Inventory.currentPrice  (immediate effect on new orders)
 *   2. PricingSuggestion table (audit trail + ML training signal)
 */

import { PrismaClient } from "@prisma/client";
import { PricingResult } from "./pricingEngine";

const prisma = new PrismaClient();

export interface WriteResult {
  inventoryUpdated: boolean;
  suggestionId: string;
  previousPrice: number;
  newPrice: number;
  priceChanged: boolean;
}

/**
 * Persist a pricing decision.
 * Skips the Inventory write if the suggested price equals the current price
 * (avoids noisy no-op updates).
 */
export async function writePriceUpdate(
  result: PricingResult
): Promise<WriteResult> {
  const { storeId, productId, suggestedPrice, currentPrice, confidence } = result;

  const priceChanged =
    Math.abs(suggestedPrice - currentPrice) >= 0.01; // ₹0.01 epsilon

  // 1. Update Inventory.currentPrice (only if price actually changed)
  if (priceChanged) {
    await prisma.inventory.update({
      where: { storeId_productId: { storeId, productId } },
      data: { currentPrice: suggestedPrice },
    });
  }

  // 2. Always write a PricingSuggestion row for auditability
  const suggestion = await prisma.pricingSuggestion.create({
    data: {
      storeId,
      productId,
      suggestedPrice,
      confidence,
      model: "rules_engine_v1",
      appliedAt: priceChanged ? new Date() : null,
    },
  });

  return {
    inventoryUpdated: priceChanged,
    suggestionId: suggestion.id,
    previousPrice: currentPrice,
    newPrice: suggestedPrice,
    priceChanged,
  };
}