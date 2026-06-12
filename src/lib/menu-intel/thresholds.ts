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
