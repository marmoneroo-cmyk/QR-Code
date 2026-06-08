/** Executive-summary / insights shapes (no server-only — safe for client + server). */

export type InsightTone = 'positive' | 'warning' | 'opportunity' | 'neutral';

export interface Insight {
  tone: InsightTone;
  text: string;
  textHe: string;
  /** Optional cocktail slug the insight is about. */
  slug?: string;
}

/**
 * Owner-facing answers to six questions, synthesized from existing analytics:
 * what to promote, what to remove, what's underperforming, what's working,
 * where customers drop off — plus a flat prioritized insight feed.
 */
export interface ExecutiveSummary {
  /** What to promote (high margin, low demand). */
  promote: string[];
  promoteHe: string[];
  /** What to remove or rework (low demand, low margin). */
  remove: string[];
  removeHe: string[];
  /** High interest but weak conversion. */
  underperforming: string[];
  underperformingHe: string[];
  /** What's driving results today. */
  working: string[];
  workingHe: string[];
  /** Where customers drop off in the funnel. */
  losing: string[];
  losingHe: string[];
  /** Flat, tone-tagged, prioritized feed combining the above. */
  insights: Insight[];
  /** False when there are no events yet (show an empty state). */
  hasData: boolean;
}
