/**
 * Diagnostic cut-points for the AI Coach — kept OUT of the engine on purpose.
 *
 * These are heuristics, not a weighted score. They WILL differ by dish category
 * (a cocktail leans on AR/video; a wine on description/ingredients; a burger may
 * have almost no AR), so they live here, externally, ready to be overridden
 * per-category and ultimately re-calibrated from observed restaurant behaviour.
 * Today the per-category map is intentionally EMPTY — we do not guess values; we
 * learn them later from real data.
 */

export interface FunnelThresholds {
  /** Stable id of this cut-point set, recorded on every recommendation's provenance
   *  (e.g. 'default_v1', 'cocktail_v1') so a year-old verdict says which bars produced it. */
  profile?: string;
  /** Below this reach we refuse to diagnose. */
  minReach: number;
  /** Healthy reach → interest. */
  healthyInterest: number;
  /** Healthy interest → high interest. */
  healthyDeep: number;
  /** Healthy high interest → ordering intent. */
  healthyIntent: number;
  /** Min video+AR deep sessions before calling a media imbalance. */
  mediaMinSample: number;
  /** Weaker medium ≤ this fraction of the stronger ⇒ mismatch. */
  mediaImbalance: number;
}

export const DEFAULT_THRESHOLDS: FunnelThresholds = {
  profile: 'default_v1',
  minReach: 30,
  healthyInterest: 0.3,
  healthyDeep: 0.3,
  healthyIntent: 0.1,
  mediaMinSample: 8,
  mediaImbalance: 0.25,
};

/** Per-category overrides — empty by design until learned from real data. */
export const CATEGORY_THRESHOLDS: Readonly<Record<string, Partial<FunnelThresholds>>> = {};

export function thresholdsFor(category?: string): FunnelThresholds {
  const override = category ? CATEGORY_THRESHOLDS[category] : undefined;
  if (!override) return DEFAULT_THRESHOLDS;
  // A category override gets its own profile id ('cocktail_v1') unless it names one,
  // so the recommendation records the category-specific bars that decided it.
  return { ...DEFAULT_THRESHOLDS, profile: `${category}_v1`, ...override };
}

/**
 * Shared sample-size → confidence bucket, so "low/medium/high" means the same thing
 * everywhere. Was previously copy-pasted byte-identical in `opportunities/build`
 * (`confidenceFrom`) and `optimization/recommend` (`confidenceFromViews`) with
 * DIFFERENT default `minSample` values — callers pass their own `minSample` explicitly
 * so each engine's existing behavior is unchanged; this only unifies the bucketing math.
 */
export function confidenceBucket(sample: number, minSample: number): 'low' | 'medium' | 'high' {
  if (sample >= minSample * 3) return 'high';
  if (sample >= minSample) return 'medium';
  return 'low';
}

/**
 * Decision cut-points for the OPPORTUNITY engine (`opportunities/build.ts`, the live
 * Coach / Action-Center rules). Centralized here in the Business Brain rather than left as
 * magic numbers inside the engine, so every AI surface reads one source and the values are
 * visible for future per-category calibration. Values are verbatim from the original inline
 * ladder — this is organization, not a behavior change. Each field maps to one rule:
 */
export const OPPORTUNITY_THRESHOLDS = {
  /** Rule 1 — interested but not ordering → review the offer. */
  minOpens: 3,
  strongOpenRate: 0.4,
  weakIntentRate: 0.15,
  /** Rule 2 — buried but loved (high open-rate when seen) → move up. */
  lovedOpenRate: 0.5,
  /** Rule 3 — shared a lot but not selling → promote harder. */
  minShares: 2,
  strongShareRate: 0.1,
  /** Rule 4 — returning-visitor engagement → promotion candidate. */
  minReturningOpens: 3,
  returningWeakIntentRate: 0.2,
  /** Rule 5 — returns repeatedly without ordering → re-engage. */
  minRepeatNoCommit: 2,
} as const;
