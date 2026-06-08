import type { MenuEngineeringItem } from '../analytics/types';

/**
 * Honest revenue-potential estimation.
 *
 * INTEGRITY: never fabricates. Upside is always derived from REAL per-item analytics
 * (views, conversion, price, margin) and tied to a stated benchmark — the menu's OWN
 * median conversion / visibility (a realistic, achievable target, not a wish). Returns
 * `null` when there isn't enough real traffic or there's no clear upside, so the UI can
 * say "collect more traffic" instead of showing a made-up number.
 */

/** Below this many views we refuse to estimate (sample too small). */
const MIN_VIEWS = 8;

export interface MenuBenchmark {
  /** Realistic achievable conversion = median of items that have real traffic. */
  medianConversionPct: number;
  /** Realistic achievable visibility = median views across the menu. */
  medianViews: number;
}

export type PotentialLever = 'conversion' | 'visibility';

export interface RevenuePotential {
  /** Extra orders if the stated benchmark is reached (rounded, ≥1). */
  extraOrders: number;
  /** Extra revenue (ILS) = extraOrders × price. */
  revenueILS: number;
  /** Extra gross profit (ILS) = extraOrders × per-unit margin. */
  profitILS: number;
  /** Which lever the estimate assumes. */
  lever: PotentialLever;
  /** Human-readable assumption (shown so the number is never a black box). */
  basisEn: string;
  basisHe: string;
  /** Tied to sample size, not to the size of the number. */
  confidence: 'low' | 'medium' | 'high';
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Build the benchmark (achievable targets) from the menu's own real data. */
export function buildMenuBenchmark(items: readonly MenuEngineeringItem[]): MenuBenchmark {
  const withTraffic = items.filter((i) => i.views >= MIN_VIEWS);
  return {
    medianConversionPct: median(withTraffic.map((i) => i.conversionPct)),
    medianViews: median(items.map((i) => i.views)),
  };
}

type PotentialInput = Pick<
  MenuEngineeringItem,
  'views' | 'conversionPct' | 'price' | 'margin' | 'highInterestLowConversion'
>;

/**
 * Estimate the upside for a single item against the menu benchmark.
 * Returns null when there's no real basis (too few views) or no clear upside.
 */
export function estimatePotential(item: PotentialInput, bench: MenuBenchmark): RevenuePotential | null {
  if (!Number.isFinite(item.views) || item.views < MIN_VIEWS) return null;
  if (item.price <= 0) return null;

  const convFrac = Math.max(0, Math.min(1, item.conversionPct / 100));
  const benchConvFrac = Math.max(0, Math.min(1, bench.medianConversionPct / 100));
  const convGap = benchConvFrac - convFrac;

  // Lever choice: a high-interest / below-median converter → close the conversion gap.
  // An already-good converter with few views → raise visibility to the median.
  const useConversion = (item.highInterestLowConversion || convGap > 0.01) && convGap > 0;

  let extraOrders: number;
  let lever: PotentialLever;
  let basisEn: string;
  let basisHe: string;

  if (useConversion) {
    extraOrders = item.views * convGap;
    lever = 'conversion';
    const pct = Math.round(bench.medianConversionPct);
    basisEn = `if conversion reaches the menu median (${pct}%)`;
    basisHe = `אם ההמרה תגיע לחציון התפריט (${pct}%)`;
  } else {
    const extraViews = Math.max(0, bench.medianViews - item.views);
    extraOrders = extraViews * convFrac;
    lever = 'visibility';
    basisEn = `if visibility reaches the menu median`;
    basisHe = `אם החשיפה תגיע לחציון התפריט`;
  }

  extraOrders = Math.round(extraOrders);
  if (extraOrders <= 0) return null; // no clear upside → don't invent one

  return {
    extraOrders,
    revenueILS: Math.round(extraOrders * item.price),
    profitILS: Math.round(extraOrders * Math.max(0, item.margin)),
    lever,
    basisEn,
    basisHe,
    confidence: item.views >= 40 ? 'high' : item.views >= 15 ? 'medium' : 'low',
  };
}

/** Aggregate upside across the whole menu (for the executive / home hero). */
export function totalPotential(items: readonly MenuEngineeringItem[]): {
  revenueILS: number;
  profitILS: number;
  /** How many items have a quantified upside (the "N actions today" count). */
  count: number;
} {
  const bench = buildMenuBenchmark(items);
  let revenueILS = 0;
  let profitILS = 0;
  let count = 0;
  for (const it of items) {
    const p = estimatePotential(it, bench);
    if (p) {
      revenueILS += p.revenueILS;
      profitILS += p.profitILS;
      count += 1;
    }
  }
  return { revenueILS, profitILS, count };
}
