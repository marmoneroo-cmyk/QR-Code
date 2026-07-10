import type { Opportunity, OpportunityType, Confidence, Bilingual, Evidence } from '../opportunities/types';
import type { MenuEngineeringItem } from '../analytics/types';
import { estimatePotential, type MenuBenchmark, type RevenuePotential } from './potential';
import { sampleConfidence } from '../menu-intel/sample';

/**
 * The unified ACTION model — every recommendation in the platform flows into ONE
 * concrete action with: estimated VALUE (₪), estimated EFFORT (time), a CONFIDENCE
 * score, the WHY (real evidence), and a one-click EXECUTE path. This is what powers
 * the AI Coach (the #1 action) and the Action Center (the top few).
 *
 * INTEGRITY: value comes from the honest estimator (null when not estimable). Why is
 * real evidence counts. Confidence is DERIVED from the observed sample (item views,
 * saturating curve) shaped by the opportunity's qualitative confidence — never a
 * fixed presentational number. Effort is a UX time estimate (clearly an estimate).
 */

export interface CoachAction {
  /** `${slug}:${type}` — same id the Opportunity board uses, so "done" state syncs. */
  id: string;
  slug: string;
  type: OpportunityType;
  /** The concrete thing to do (bilingual). */
  title: Bilingual;
  /** Real evidence — the "why". */
  why: Evidence[];
  /** Estimated revenue upside in ILS, or null when not estimable. */
  valueILS: number | null;
  potential: RevenuePotential | null;
  /** Estimated minutes of effort. */
  effortMin: number;
  /** 0–100 confidence. */
  confidencePct: number;
  priority: number;
  /** One-click execution deep link (reuses the platform's Apply contract). */
  executeHref: string;
  executeLabel: Bilingual;
}

/** Estimated minutes to carry out each action type (a UX estimate, not measured data). */
const EFFORT_MIN: Record<OpportunityType, number> = {
  promote_position: 1,
  promote_marketing: 2,
  promotion_candidate: 2,
  fix_offer: 5,
  reengage_returning: 3,
};

/**
 * Confidence % derived from the REAL observed sample (the item's drink-page views),
 * shaped by the opportunity's qualitative separation. Mirrors the funnel engine's
 * saturating sample curve (n / (n + 60)) — 100 views can no longer claim 91%
 * certainty, and no data honestly reads as 0.
 */
const QUAL_SEPARATION: Record<Confidence, number> = { low: 0.55, medium: 0.75, high: 0.95 };

function confidencePctOf(confidence: Confidence, sampleN: number): number {
  const sample = sampleConfidence(sampleN); // ONE shared curve with the funnel engine (see menu-intel/sample)
  return Math.round(Math.min(0.95, sample * QUAL_SEPARATION[confidence]) * 100);
}

function executeFor(type: OpportunityType, slug: string): { href: string; label: Bilingual } {
  const s = encodeURIComponent(slug);
  switch (type) {
    case 'fix_offer':
      return { href: `/admin/${s}/edit`, label: { en: 'Fix the offer', he: 'תקנו את ההצעה' } };
    case 'promote_position':
    case 'promote_marketing':
    case 'promotion_candidate':
      return { href: `/admin/promotions?cocktail=${s}`, label: { en: 'Create promotion', he: 'צרו מבצע' } };
    case 'reengage_returning':
      return { href: `/admin/promotions?cocktail=${s}`, label: { en: 'Re-engage guests', he: 'החזירו אורחים' } };
  }
}

/**
 * Build the ranked action list from opportunities + per-item economics.
 * Ranked by estimated ₪ value (desc, nulls last), then by the opportunity's priority.
 */
export function buildActions(
  opportunities: readonly Opportunity[],
  itemBySlug: ReadonlyMap<string, MenuEngineeringItem>,
  bench: MenuBenchmark,
): CoachAction[] {
  const actions: CoachAction[] = opportunities.map((o) => {
    const item = itemBySlug.get(o.slug);
    const potential = item ? estimatePotential(item, bench) : null;
    const ex = executeFor(o.type, o.slug);
    return {
      id: `${o.slug}:${o.type}`,
      slug: o.slug,
      type: o.type,
      title: o.action,
      why: o.evidence,
      valueILS: potential ? potential.revenueILS : null,
      potential,
      effortMin: EFFORT_MIN[o.type],
      confidencePct: confidencePctOf(o.confidence, item?.views ?? 0),
      priority: o.priority,
      executeHref: ex.href,
      executeLabel: ex.label,
    };
  });

  return actions.sort((a, b) => {
    const av = a.valueILS ?? -1;
    const bv = b.valueILS ?? -1;
    if (bv !== av) return bv - av;
    return b.priority - a.priority;
  });
}
