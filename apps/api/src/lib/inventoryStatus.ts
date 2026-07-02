/**
 * Shared inventory status/level logic — used by both GET /inventory/:storeId
 * and the Traffic Simulator's stock-update SSE broadcast, so both paths
 * always agree on what counts as HEALTHY/LOW_STOCK/CRITICAL.
 */

export type InventoryStatus = "HEALTHY" | "LOW_STOCK" | "CRITICAL";

export function computeInventoryStatus(
  quantityOnHand: number,
  reorderLevel: number,
): InventoryStatus {
  const criticalThreshold = Math.max(reorderLevel * 0.5, 5);
  if (quantityOnHand <= criticalThreshold) return "CRITICAL";
  if (quantityOnHand <= reorderLevel) return "LOW_STOCK";
  return "HEALTHY";
}

export function computeLevelPercent(
  quantityOnHand: number,
  reorderLevel: number,
  reorderQty: number,
): number {
  const fullStockTarget = reorderLevel + reorderQty;
  if (fullStockTarget <= 0) return 0;
  return Math.min(100, Math.round((quantityOnHand / fullStockTarget) * 100));
}