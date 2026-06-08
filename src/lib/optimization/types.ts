/**
 * Menu Optimization Layer — turns analytics into ACTIONS.
 * Every recommendation answers "what should the owner do next?" with a rationale,
 * a confidence level, and a numeric impact estimate ONLY when the data supports it
 * (never a fabricated number — that is the integrity gate from /admin/signals).
 */

export interface Bilingual {
  en: string;
  he: string;
}

export type Confidence = 'low' | 'medium' | 'high';

export type RecAction =
  | 'fix_offer' // high interest, low conversion → test image/description/price
  | 'promote_position' // high margin, low visibility → move up / feature
  | 'raise_price' // popular, thin margin → price test
  | 'reduce_cost'
  | 'feature'
  | 'keep_position' // a star → protect it
  | 'review_or_remove'; // low interest + low margin

export interface Recommendation {
  slug: string;
  action: RecAction;
  /** Imperative "do this" line. */
  headline: Bilingual;
  /** The evidence behind it (cites the numbers). */
  rationale: Bilingual;
  /** Set ONLY when derivable from data AND confidence is sufficient. */
  estimatedImpact?: Bilingual;
  confidence: Confidence;
  /** Higher = surface first. */
  priority: number;
}

export interface RecommendOptions {
  /** Minimum item views for a numeric estimate / above-low confidence. */
  minSample?: number;
}
