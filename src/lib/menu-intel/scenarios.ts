/**
 * 30 synthetic funnel scenarios — the validation set for the AI Coach brain.
 * Each is a known engagement shape with the ONE recommendation it must produce.
 * If diagnoseFunnel() stops returning `expected` for any of these, the brain has
 * regressed. This is the most important test in the system: it guards the product's
 * actual value (the recommendation), independent of any infrastructure.
 */
import type { FunnelShape, Diagnosis } from './funnel';

export interface Scenario {
  name: string;
  funnel: FunnelShape;
  expected: Diagnosis;
  note: string;
}

export const SCENARIOS: Scenario[] = [
  // ── Not enough data ─────────────────────────────────────────────────────────
  { name: 'tiny sample', funnel: { reach: 10, interest: 8, highInterest: 5, orderingIntent: 2 }, expected: 'insufficient_data', note: 'reach below the floor' },
  { name: 'no traffic', funnel: { reach: 0, interest: 0, highInterest: 0, orderingIntent: 0 }, expected: 'insufficient_data', note: 'nothing yet' },
  { name: 'just-below floor', funnel: { reach: 29, interest: 20, highInterest: 10, orderingIntent: 4 }, expected: 'insufficient_data', note: 'one short of MIN_REACH' },

  // ── Discovery problem — and the dish itself is weak (few open, few of those convert)
  { name: 'ignored & flat', funnel: { reach: 1000, interest: 50, highInterest: 5, orderingIntent: 0 }, expected: 'low_discovery', note: 'image/name/concept' },
  { name: 'low open low convert', funnel: { reach: 500, interest: 60, highInterest: 10, orderingIntent: 2 }, expected: 'low_discovery', note: 'weak top + weak convert' },
  { name: 'modest open, no want', funnel: { reach: 1000, interest: 200, highInterest: 30, orderingIntent: 5 }, expected: 'low_discovery', note: '20% open but 2.5% of them want it' },
  { name: 'barely opened', funnel: { reach: 300, interest: 30, highInterest: 3, orderingIntent: 0 }, expected: 'low_discovery', note: 'no pull at all' },

  // ── Exposure gap — those who DO open it want it; the problem is visibility
  { name: 'Truffle Burger (exposure)', funnel: { reach: 1000, interest: 100, highInterest: 20, orderingIntent: 15 }, expected: 'exposure_gap', note: 'good dish, few discover it' },
  { name: 'hidden gem', funnel: { reach: 800, interest: 120, highInterest: 40, orderingIntent: 20 }, expected: 'exposure_gap', note: '15% open → 16% of them want it' },
  { name: 'buried but loved', funnel: { reach: 1000, interest: 80, highInterest: 30, orderingIntent: 12 }, expected: 'exposure_gap', note: 'strong convert, tiny reach→open' },
  { name: 'niche winner', funnel: { reach: 500, interest: 50, highInterest: 20, orderingIntent: 8 }, expected: 'exposure_gap', note: 'few see it, those who do act' },

  // ── Shallow engagement — they open but don't go deep (balanced media)
  { name: 'open then bounce', funnel: { reach: 1000, interest: 600, highInterest: 100, orderingIntent: 10 }, expected: 'shallow_engagement', note: 'opens but 17% go deep' },
  { name: 'curious not hooked', funnel: { reach: 500, interest: 250, highInterest: 50, orderingIntent: 5 }, expected: 'shallow_engagement', note: '20% deep' },
  { name: 'media used evenly, still shallow', funnel: { reach: 1000, interest: 800, highInterest: 150, orderingIntent: 12, videoDeep: 80, arDeep: 70 }, expected: 'shallow_engagement', note: 'balanced media, low depth' },
  { name: 'thin depth', funnel: { reach: 400, interest: 200, highInterest: 40, orderingIntent: 4 }, expected: 'shallow_engagement', note: '20% deep' },

  // ── Media mismatch — engagement is lopsided across video vs AR
  { name: 'AR carries, video dead', funnel: { reach: 1000, interest: 700, highInterest: 120, orderingIntent: 10, videoDeep: 5, arDeep: 110 }, expected: 'media_mismatch', note: 'lead with AR' },
  { name: 'video carries, AR dead', funnel: { reach: 1000, interest: 600, highInterest: 100, orderingIntent: 8, videoDeep: 95, arDeep: 5 }, expected: 'media_mismatch', note: 'lead with video' },
  { name: 'video ignored', funnel: { reach: 1000, interest: 600, highInterest: 100, orderingIntent: 8, videoDeep: 90, arDeep: 5 }, expected: 'media_mismatch', note: 'AR barely used' },

  // ── Weak conversion — deep love, no next step (the Aperol case)
  { name: 'Aperol (loved, no action)', funnel: { reach: 1000, interest: 900, highInterest: 800, orderingIntent: 20, revisits: 0 }, expected: 'weak_conversion', note: 'price/value/CTA' },
  { name: 'adored, stalls at intent', funnel: { reach: 500, interest: 400, highInterest: 300, orderingIntent: 15, revisits: 0 }, expected: 'weak_conversion', note: '5% intent' },
  { name: 'deep but undecided', funnel: { reach: 1000, interest: 700, highInterest: 400, orderingIntent: 30, revisits: 10 }, expected: 'weak_conversion', note: 'revisits too few for stall' },
  { name: 'high interest low intent', funnel: { reach: 300, interest: 200, highInterest: 120, orderingIntent: 6, revisits: 2 }, expected: 'weak_conversion', note: 'price likely' },

  // ── Consideration stall — they keep coming back but never act
  { name: 'repeat visitors, no intent', funnel: { reach: 1000, interest: 600, highInterest: 200, orderingIntent: 10, revisits: 100 }, expected: 'consideration_stall', note: 'hesitation: price/portion' },
  { name: 'comes back, won’t commit', funnel: { reach: 500, interest: 300, highInterest: 100, orderingIntent: 5, revisits: 60 }, expected: 'consideration_stall', note: 'strong revisit, no intent' },

  // ── Performing — healthy all the way down
  { name: 'star item', funnel: { reach: 1000, interest: 700, highInterest: 400, orderingIntent: 120, revisits: 50, videoDeep: 200, arDeep: 200 }, expected: 'performing', note: 'feature it' },
  { name: 'solid performer', funnel: { reach: 500, interest: 300, highInterest: 200, orderingIntent: 40 }, expected: 'performing', note: 'healthy funnel' },
  { name: 'big and healthy', funnel: { reach: 2000, interest: 1200, highInterest: 600, orderingIntent: 90 }, expected: 'performing', note: 'scales well' },
  { name: 'hero dish', funnel: { reach: 1000, interest: 900, highInterest: 700, orderingIntent: 200 }, expected: 'performing', note: 'best in class' },

  // ── Two more edges ──────────────────────────────────────────────────────────
  { name: 'tiny-reach exposure gem', funnel: { reach: 600, interest: 40, highInterest: 15, orderingIntent: 6 }, expected: 'exposure_gap', note: '6.7% open, 15% of them want it' },
  { name: 'performer with revisits', funnel: { reach: 800, interest: 500, highInterest: 300, orderingIntent: 50, revisits: 30 }, expected: 'performing', note: 'healthy + loyal' },

  // ── Confidence contrasts — SAME shape, different scale (same diagnosis, different certainty)
  { name: 'weak_conversion (tiny → low conf)', funnel: { reach: 50, interest: 40, highInterest: 30, orderingIntent: 2 }, expected: 'weak_conversion', note: 'right call, thin evidence' },
  { name: 'weak_conversion (huge → high conf)', funnel: { reach: 50000, interest: 40000, highInterest: 30000, orderingIntent: 2000 }, expected: 'weak_conversion', note: 'same shape, strong evidence' },
  { name: 'exposure_gap (tiny → low conf)', funnel: { reach: 40, interest: 10, highInterest: 4, orderingIntent: 2 }, expected: 'exposure_gap', note: 'good convert, tiny n' },
  { name: 'exposure_gap (huge → high conf)', funnel: { reach: 40000, interest: 10000, highInterest: 4000, orderingIntent: 2000 }, expected: 'exposure_gap', note: 'good convert, big n' },
  { name: 'low_discovery (huge)', funnel: { reach: 20000, interest: 2000, highInterest: 200, orderingIntent: 20 }, expected: 'low_discovery', note: 'clearly weak at scale' },
  { name: 'shallow_engagement (huge)', funnel: { reach: 5000, interest: 3000, highInterest: 400, orderingIntent: 30 }, expected: 'shallow_engagement', note: '13% deep at scale' },
  { name: 'performing (huge)', funnel: { reach: 100000, interest: 60000, highInterest: 30000, orderingIntent: 6000 }, expected: 'performing', note: 'star at scale' },
  { name: 'performing (small but healthy)', funnel: { reach: 40, interest: 30, highInterest: 20, orderingIntent: 4 }, expected: 'performing', note: 'healthy shape, modest conf' },

  // ── Boundary cases (just over / under the cut-points)
  { name: 'exposure_gap boundary (i2i just ≥ 0.1)', funnel: { reach: 1000, interest: 250, highInterest: 40, orderingIntent: 26 }, expected: 'exposure_gap', note: 'converts once seen' },
  { name: 'low_discovery boundary (i2i just < 0.1)', funnel: { reach: 1000, interest: 250, highInterest: 40, orderingIntent: 20 }, expected: 'low_discovery', note: 'weak even when seen' },
  { name: 'performing boundary (intentRate == 0.1)', funnel: { reach: 1000, interest: 600, highInterest: 300, orderingIntent: 30 }, expected: 'performing', note: 'exactly at the line counts as healthy' },
  { name: 'weak_conversion just under the line', funnel: { reach: 1000, interest: 600, highInterest: 300, orderingIntent: 29 }, expected: 'weak_conversion', note: 'a hair below healthy intent' },
  { name: 'insufficient just below floor', funnel: { reach: 28, interest: 25, highInterest: 20, orderingIntent: 8 }, expected: 'insufficient_data', note: 'reach < min' },

  // ── Media at scale (both directions) + balanced-but-shallow
  { name: 'media_mismatch (AR carries, at scale)', funnel: { reach: 5000, interest: 3000, highInterest: 400, orderingIntent: 30, videoDeep: 20, arDeep: 380 }, expected: 'media_mismatch', note: 'lead with AR' },
  { name: 'media_mismatch (video carries, at scale)', funnel: { reach: 5000, interest: 3500, highInterest: 500, orderingIntent: 40, videoDeep: 470, arDeep: 30 }, expected: 'media_mismatch', note: 'lead with video' },
  { name: 'shallow despite balanced media', funnel: { reach: 2000, interest: 1200, highInterest: 300, orderingIntent: 30, videoDeep: 150, arDeep: 150 }, expected: 'shallow_engagement', note: 'both media used, still shallow' },
  { name: 'performing with balanced deep media', funnel: { reach: 2000, interest: 1000, highInterest: 500, orderingIntent: 80, videoDeep: 250, arDeep: 250 }, expected: 'performing', note: 'media healthy, funnel healthy' },

  // ── Consideration stall vs weak conversion (revisit threshold)
  { name: 'consideration_stall (at scale)', funnel: { reach: 3000, interest: 1800, highInterest: 600, orderingIntent: 30, revisits: 300 }, expected: 'consideration_stall', note: 'lots of revisits, no act' },
  { name: 'weak_conversion (revisits below stall bar)', funnel: { reach: 3000, interest: 1800, highInterest: 600, orderingIntent: 30, revisits: 200 }, expected: 'weak_conversion', note: 'revisits too few to call a stall' },
  { name: 'media_mismatch (AR never lands, video only)', funnel: { reach: 1000, interest: 700, highInterest: 110, orderingIntent: 9, videoDeep: 105, arDeep: 0 }, expected: 'media_mismatch', note: 'one medium is dead' },
];
