/**
 * The AI Coach BRAIN — read the SHAPE of a dish's engagement funnel and name the
 * single primary bottleneck → one recommendation.
 *
 * PURE & DETERMINISTIC. No production data, no auth/queue/network dependency. It is
 * validated entirely by synthetic scenarios (see scenarios.ts + funnel.test.ts), so
 * it can be built and trusted NOW, in parallel with the Security sprint, long before
 * it is ever pointed at real (and trustworthy) restaurant data.
 *
 * The numeric cut-points below are DIAGNOSTIC heuristics, deliberately tunable — they
 * are meant to be re-calibrated from observed restaurant behaviour later. They are NOT
 * a weighted score (the product has no hard-coded Menu Performance Score; see
 * ordering-intent-spec.md).
 */

/** Distinct sessions that reached each rung — highest-rung-per-session (no double-count). */
export interface FunnelShape {
  reach: number;          // saw the dish (impression)
  interest: number;       // opened / explored at all
  highInterest: number;   // video ≥ 50% · AR deep · revisits
  orderingIntent: number; // wants-this · favorite · ready-to-order
  /** Optional media split within engagement, for "lead with the winning medium" advice. */
  videoDeep?: number;
  arDeep?: number;
  /** Optional: distinct sessions that came back to the dish (consideration signal). */
  revisits?: number;
}

export type Diagnosis =
  | 'insufficient_data'   // not enough reach to judge
  | 'low_discovery'       // few open it AND those who do don't convert → image / name / concept
  | 'exposure_gap'        // few open it BUT those who engage want it → visibility / position
  | 'shallow_engagement'  // open but don't go deep → richer media / clearer description
  | 'media_mismatch'      // engagement is lopsided across video vs AR → lead with the winner
  | 'consideration_stall' // they come back but never act → hesitation: price / portion / clarity
  | 'weak_conversion'     // deep interest but no next step → price / value / call-to-action
  | 'performing';         // healthy all the way down → feature / keep

export type Bottleneck = 'reach→interest' | 'interest→high' | 'high→intent' | 'none';

export interface Recommendation {
  diagnosis: Diagnosis;
  bottleneck: Bottleneck | null;
  rates: {
    interestRate: number;       // interest / reach
    deepRate: number;           // highInterest / interest
    intentRate: number;         // orderingIntent / highInterest
    interestToIntent: number;   // orderingIntent / interest (does it convert once opened?)
    overallIntentRate: number;  // orderingIntent / reach
  };
}

// ── Tunable diagnostic cut-points (recalibrate from real data later) ───────────
const MIN_REACH = 30;            // below this we refuse to diagnose
const HEALTHY_INTEREST = 0.3;    // reach → interest
const HEALTHY_DEEP = 0.3;        // interest → high interest
const HEALTHY_INTENT = 0.1;      // high interest → ordering intent (also "converts once opened")
const MEDIA_MIN_SAMPLE = 8;      // min video+AR deep sessions to call a media imbalance
const MEDIA_IMBALANCE = 0.25;    // weaker medium ≤ 25% of the stronger ⇒ mismatch

const rate = (a: number, b: number): number => (b > 0 ? a / b : 0);

export function diagnoseFunnel(f: FunnelShape): Recommendation {
  const interestRate = rate(f.interest, f.reach);
  const deepRate = rate(f.highInterest, f.interest);
  const intentRate = rate(f.orderingIntent, f.highInterest);
  const interestToIntent = rate(f.orderingIntent, f.interest);
  const overallIntentRate = rate(f.orderingIntent, f.reach);
  const rates = { interestRate, deepRate, intentRate, interestToIntent, overallIntentRate };
  const out = (diagnosis: Diagnosis, bottleneck: Bottleneck | null): Recommendation => ({ diagnosis, bottleneck, rates });

  if (f.reach < MIN_REACH) return out('insufficient_data', null);

  // 1) Discovery — few people open it at all.
  if (interestRate < HEALTHY_INTEREST) {
    // Do those who DO open it end up wanting it? If yes, it's a visibility problem, not the dish.
    return interestToIntent >= HEALTHY_INTENT
      ? out('exposure_gap', 'reach→interest')
      : out('low_discovery', 'reach→interest');
  }

  // 2) Engagement — they open but don't go deep.
  if (deepRate < HEALTHY_DEEP) {
    const mm = mediaMismatch(f);
    return mm ? out('media_mismatch', 'interest→high') : out('shallow_engagement', 'interest→high');
  }

  // 3) Conversion — deep interest but no next step.
  if (intentRate < HEALTHY_INTENT) {
    const revisits = f.revisits ?? 0;
    if (revisits >= Math.max(5, f.highInterest * 0.4)) return out('consideration_stall', 'high→intent');
    return out('weak_conversion', 'high→intent');
  }

  return out('performing', 'none');
}

function mediaMismatch(f: FunnelShape): boolean {
  if (f.videoDeep === undefined || f.arDeep === undefined) return false;
  const v = f.videoDeep, a = f.arDeep, total = v + a;
  if (total < MEDIA_MIN_SAMPLE) return false;
  return Math.min(v, a) <= MEDIA_IMBALANCE * Math.max(v, a);
}
