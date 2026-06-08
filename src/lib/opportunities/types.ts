/**
 * Opportunity Board — the "what should I do today?" surface. Turns assembled
 * behavioural signals into typed, prioritised opportunities. Same integrity gate
 * as the rest of the platform: evidence is real counts; the action is a DIRECTION,
 * never a fabricated revenue/percentage number.
 */

export interface Bilingual {
  en: string;
  he: string;
}

export type Confidence = 'low' | 'medium' | 'high';

export type OpportunityType =
  | 'fix_offer' // high engagement + low intent → review image/description/price
  | 'promote_position' // low visibility + high engagement → move higher (uses menu position)
  | 'promote_marketing' // high sharing + low sales → promote more aggressively
  | 'promotion_candidate' // strong engagement from returning visitors → candidate for a promotion
  | 'reengage_returning'; // returning visitors who repeatedly view without committing → nudge

export interface Evidence {
  label: Bilingual;
  value: string;
}

export interface Opportunity {
  slug: string;
  type: OpportunityType;
  confidence: Confidence;
  evidence: Evidence[];
  action: Bilingual;
  /** Higher = surface first. */
  priority: number;
}

/** Per-item signals assembled by the server query from raw events + sales. */
export interface ItemSignals {
  slug: string;
  /** 0-based menu position (lower = nearer the top). */
  position: number;
  /** Distinct sessions that SAW the card on the menu (visibility). */
  impressions: number;
  /** Distinct sessions that opened the detail page (interest). */
  opens: number;
  dwellAvgMs: number;
  shares: number;
  /** Distinct sessions that favorited (intent). */
  favorites: number;
  /** Opens by returning visitors (visitor seen in >1 session). */
  returningOpens: number;
  /** Returning visitors who opened across ≥2 sessions but never favorited/ordered. */
  repeatNoCommit: number;
  salesUnits: number;
  salesRevenue: number;
}

export interface CategoryReach {
  category: string;
  reachPct: number;
}

export interface LayoutInsight {
  sessions: number;
  /** Share of sessions reaching the first 3 items / half / all of the menu. */
  reachedFirst3Pct: number;
  reachedHalfPct: number;
  reachedAllPct: number;
  /** Slugs almost never seen (bottom of the visibility distribution). */
  rarelyReached: string[];
  categoryReach: CategoryReach[];
}

export interface MenuSignals {
  items: ItemSignals[];
  layout: LayoutInsight;
  hasData: boolean;
}

export interface OpportunityOptions {
  /** Minimum opens (or relevant sample) for above-low confidence. */
  minSample?: number;
}
