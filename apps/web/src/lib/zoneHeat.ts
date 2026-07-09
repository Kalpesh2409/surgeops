import type { PriceEntry } from "@/hooks/usePriceStream";

export type ZoneHeatState = "normal" | "elevated" | "surge";

export const SURGE_THRESHOLD = 1.3;

export interface ZoneHeatResult {
  state: ZoneHeatState;
  surgingCount: number;
  totalCount: number;
  surgingPercent: number;
}

export function computeZoneHeat(
  prices: Record<string, PriceEntry>,
): ZoneHeatResult {
  const entries = Object.values(prices);
  const totalCount = entries.length;

  if (totalCount === 0) {
    return {
      state: "normal",
      surgingCount: 0,
      totalCount: 0,
      surgingPercent: 0,
    };
  }

  const surgingCount = entries.filter(
    (p) => p.surgeMultiplier >= SURGE_THRESHOLD,
  ).length;

  const surgingPercent = (surgingCount / totalCount) * 100;

  let state: ZoneHeatState;
  if (surgingPercent > 50) {
    state = "surge";
  } else if (surgingPercent >= 20) {
    state = "elevated";
  } else {
    state = "normal";
  }

  return { state, surgingCount, totalCount, surgingPercent };
}
