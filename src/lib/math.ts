/**
 * Tiny shared numeric helpers for the analytics + Business-Brain modules. Kept in ONE
 * place so the median that sets a benchmark and the median that ranks an opportunity can
 * never diverge — these were previously copy-pasted across three files (`analytics/queries`,
 * `opportunities/build`, `value/potential`) and `clamp01` across two.
 */

/** Clamp to the unit interval [0, 1]. */
export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Median of a numeric list. Empty → 0; even length → mean of the two central values. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
