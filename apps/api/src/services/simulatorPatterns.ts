/**
 * simulatorPatterns.ts
 * Time-of-day demand multipliers and product category weights
 * for realistic Indian quick-commerce simulation.
 */

export interface HourPattern {
  hour: number;       // 0–23 (IST)
  multiplier: number; // base order rate multiplier
  label: string;
}

/**
 * Indian quick-commerce demand curve:
 * - Morning spike: 7–9am (breakfast / office commute)
 * - Lunch spike: 12–2pm
 * - Evening spike: 6–9pm (dinner / snacks)
 * - Night dip: 11pm–6am
 */
export const HOUR_PATTERNS: HourPattern[] = [
  { hour: 0,  multiplier: 0.05, label: 'dead_night' },
  { hour: 1,  multiplier: 0.03, label: 'dead_night' },
  { hour: 2,  multiplier: 0.02, label: 'dead_night' },
  { hour: 3,  multiplier: 0.02, label: 'dead_night' },
  { hour: 4,  multiplier: 0.03, label: 'dead_night' },
  { hour: 5,  multiplier: 0.05, label: 'early_morning' },
  { hour: 6,  multiplier: 0.15, label: 'early_morning' },
  { hour: 7,  multiplier: 0.60, label: 'morning_rush' },
  { hour: 8,  multiplier: 0.85, label: 'morning_rush' },
  { hour: 9,  multiplier: 0.70, label: 'morning_rush' },
  { hour: 10, multiplier: 0.45, label: 'mid_morning' },
  { hour: 11, multiplier: 0.55, label: 'pre_lunch' },
  { hour: 12, multiplier: 0.90, label: 'lunch_rush' },
  { hour: 13, multiplier: 1.00, label: 'lunch_rush' },  // peak
  { hour: 14, multiplier: 0.75, label: 'lunch_rush' },
  { hour: 15, multiplier: 0.40, label: 'afternoon_lull' },
  { hour: 16, multiplier: 0.45, label: 'afternoon_lull' },
  { hour: 17, multiplier: 0.65, label: 'pre_evening' },
  { hour: 18, multiplier: 0.85, label: 'evening_rush' },
  { hour: 19, multiplier: 0.95, label: 'evening_rush' },
  { hour: 20, multiplier: 1.00, label: 'evening_rush' },  // peak
  { hour: 21, multiplier: 0.80, label: 'evening_rush' },
  { hour: 22, multiplier: 0.50, label: 'late_night' },
  { hour: 23, multiplier: 0.20, label: 'late_night' },
];

/** Base orders-per-minute at multiplier=1.0 (per store) */
export const BASE_ORDERS_PER_MINUTE = 2;

/** Max items in a single simulated order */
export const MAX_ITEMS_PER_ORDER = 5;

/** Category demand weights — how likely a product from this category is ordered */
export const CATEGORY_DEMAND_WEIGHTS: Record<string, number> = {
  groceries:    1.0,
  beverages:    0.85,
  snacks:       0.90,
  dairy:        0.75,
  household:    0.50,
  personal_care: 0.40,
  default:       0.60,
};

/** Event types that get written to DemandEvent */
export type DemandEventType = 'ORDER_PLACED' | 'SURGE_DETECTED' | 'STOCK_LOW' | 'RESTOCK';

/** Surge threshold: if orders/min exceeds this multiplier, emit SURGE_DETECTED */
export const SURGE_THRESHOLD_MULTIPLIER = 0.80;

/** Get current IST hour (UTC+5:30) */
export function getCurrentISTHour(): number {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const istMs = utcMs + 5.5 * 60 * 60_000;
  return new Date(istMs).getHours();
}

/** Get demand multiplier for a given IST hour */
export function getDemandMultiplier(istHour: number): number {
  return HOUR_PATTERNS[istHour]?.multiplier ?? 0.5;
}

/** Get demand label for a given IST hour */
export function getDemandLabel(istHour: number): string {
  return HOUR_PATTERNS[istHour]?.label ?? 'unknown';
}

/** Weighted random pick from an array using provided weights */
export function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Gaussian-ish noise: random value in [min, max] biased toward center */
export function jitter(base: number, pct: number = 0.2): number {
  const delta = base * pct;
  return base + (Math.random() * 2 - 1) * delta;
}