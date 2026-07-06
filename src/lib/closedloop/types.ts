/**
 * Closed Loop Optimization — Recommendation → Action → Measured Result → Status.
 * The measurement engine is pure & integrity-gated: it reports a delta only when
 * both the before and after windows have enough sample; otherwise it says
 * "too early" / "insufficient data" — never a fabricated number.
 */

export type ChangeKind = 'promotion' | 'experience' | 'price' | 'position' | 'image' | 'other';

export type MetricKey = 'views' | 'opens' | 'favorites' | 'intent' | 'sales' | 'shares';

export type ImpactStatus = 'success' | 'declined' | 'no_effect' | 'too_early' | 'insufficient_data';

export type Confidence = 'low' | 'medium' | 'high';

export interface MeasureInput {
  /** Metric total in the pre-change window [T−W, T]. */
  before: number;
  /** Metric total in the post-change window [T, T+elapsed]. */
  after: number;
  /** Days elapsed since the change was applied. */
  daysSince: number;
}

export interface MeasureOptions {
  /** Comparison window length in days (default 7). A verdict needs a COMPLETE post window. */
  windowDays?: number;
  /** Minimum before+after sample to report a delta (default 12). */
  minSample?: number;
  /** Minimum sample on EACH side before a delta is reportable (default 6). A zero/tiny baseline cannot yield a trustworthy lift. */
  minPerArm?: number;
  /** Minimum absolute change |after−before| to count as an effect — filters tiny-count noise (default 5). */
  minAbsDelta?: number;
  /** |delta| below this % counts as "no clear effect" (default 10). */
  noEffectBandPct?: number;
}

export interface ImpactResult {
  status: ImpactStatus;
  /** Equal-window count change, %, rounded. null unless reportable. */
  deltaPct: number | null;
  direction: 'up' | 'down' | 'flat' | null;
}
