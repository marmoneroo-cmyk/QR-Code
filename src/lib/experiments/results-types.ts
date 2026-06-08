/** A/B results shapes (no server-only — shared by route + page). */

export interface VariantResult {
  id: string;
  label: { en: string; he: string };
  exposures: number;
  conversions: number;
  conversionPct: number;
  /** Relative uplift vs control, percent (control itself is 0). */
  upliftPct: number;
  isControl: boolean;
  isWinner: boolean;
}

export interface ExperimentResult {
  id: string;
  attribute: { en: string; he: string };
  status: 'running' | 'paused';
  variants: VariantResult[];
  /** Two-proportion test confidence that the leader differs from control (%). */
  confidencePct: number;
  /** True once confidence ≥ 95% and both variants have exposures. */
  significant: boolean;
  hasData: boolean;
}

export interface ExperimentsResponse {
  experiments: ExperimentResult[];
}
