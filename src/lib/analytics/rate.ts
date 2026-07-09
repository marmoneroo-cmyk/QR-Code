/**
 * Honest rate presentation — the display-layer twin of the closed-loop engine's
 * `insufficient_data` gate and the funnel's `minReach` guard.
 *
 * A percentage computed from a tiny denominator fabricates confidence: "100% ordered"
 * from 2 views is noise dressed as a fact, and an owner who acts on it is acting on
 * nothing. Below MIN_CONFIDENT_SAMPLE distinct observations we refuse the number and
 * say so, rather than print a precise-looking lie.
 *
 * INTEGRITY: this NEVER changes the stored/aggregate math — it only decides whether a
 * rate is trustworthy enough to SHOW. The percentage itself is unchanged when confident.
 */

/** Minimum denominator (distinct observations) before a rate is worth trusting. */
export const MIN_CONFIDENT_SAMPLE = 25;

export interface RateView {
  /** True when the denominator is large enough to trust the rate. */
  confident: boolean;
  /** Rounded percentage 0–100. Only meaningful to display when `confident`. */
  pct: number;
  /** The denominator actually observed (floored, never negative). */
  sample: number;
}

/**
 * Judge whether a numerator/denominator rate is backed by enough sample to show.
 * @param numerator   e.g. orders
 * @param denominator e.g. distinct views/sessions (the confidence-bearing quantity)
 * @param minSample   override the default gate (defaults to MIN_CONFIDENT_SAMPLE)
 */
export function confidentRate(
  numerator: number,
  denominator: number,
  minSample: number = MIN_CONFIDENT_SAMPLE,
): RateView {
  const sample = denominator > 0 ? Math.floor(denominator) : 0;
  const pct = sample > 0 ? Math.round((numerator / sample) * 100) : 0;
  return { confident: sample >= minSample, pct, sample };
}

/** True when a denominator clears the confidence gate. Convenience for call sites that already hold the pct. */
export function hasConfidentSample(denominator: number, minSample: number = MIN_CONFIDENT_SAMPLE): boolean {
  return denominator >= minSample;
}
