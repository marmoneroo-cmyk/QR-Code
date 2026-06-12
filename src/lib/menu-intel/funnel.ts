/**
 * The AI Coach BRAIN — read the SHAPE of a dish's engagement funnel and name the
 * single primary bottleneck → one recommendation, with how SURE we are and WHY.
 *
 * PURE & DETERMINISTIC. No production data, no auth/queue/network dependency. It is
 * validated entirely by synthetic scenarios (scenarios.ts + funnel.test.ts), so it
 * can be built and trusted NOW, long before it is pointed at real (trustworthy) data.
 *
 * Cut-points live in thresholds.ts (per-category, tunable) — NOT a weighted score.
 */
import { DEFAULT_THRESHOLDS, type FunnelThresholds } from './thresholds';

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
  /** Confidence IN THE DIAGNOSIS — driven by sample size + how clear-cut the bottleneck is. 0..0.99. */
  confidence: number;
  /** The counts that support the diagnosis (owner-readable). */
  evidence: string[];
  rates: {
    interestRate: number;       // interest / reach
    deepRate: number;           // highInterest / interest
    intentRate: number;         // orderingIntent / highInterest
    interestToIntent: number;   // orderingIntent / interest (does it convert once opened?)
    overallIntentRate: number;  // orderingIntent / reach
  };
}

const rate = (a: number, b: number): number => (b > 0 ? a / b : 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const pct = (r: number): string => `${Math.round(r * 100)}%`;

export function diagnoseFunnel(f: FunnelShape, t: FunnelThresholds = DEFAULT_THRESHOLDS): Recommendation {
  const interestRate = rate(f.interest, f.reach);
  const deepRate = rate(f.highInterest, f.interest);
  const intentRate = rate(f.orderingIntent, f.highInterest);
  const interestToIntent = rate(f.orderingIntent, f.interest);
  const overallIntentRate = rate(f.orderingIntent, f.reach);
  const rates = { interestRate, deepRate, intentRate, interestToIntent, overallIntentRate };

  const make = (
    diagnosis: Diagnosis,
    bottleneck: Bottleneck | null,
    sampleN: number,
    observed: number,
    threshold: number,
    evidence: string[],
  ): Recommendation => ({
    diagnosis,
    bottleneck,
    rates,
    evidence,
    confidence: confidenceOf(diagnosis, sampleN, observed, threshold),
  });

  if (f.reach < t.minReach) {
    return make('insufficient_data', null, f.reach, 0, t.minReach, [`reach ${f.reach} (< ${t.minReach})`]);
  }

  // 1) Discovery — few people open it at all.
  if (interestRate < t.healthyInterest) {
    const evidence = [`${f.reach} reach`, `${f.interest} opened (${pct(interestRate)})`, `${f.orderingIntent} intent`];
    return interestToIntent >= t.healthyIntent
      ? make('exposure_gap', 'reach→interest', f.reach, interestRate, t.healthyInterest, evidence)
      : make('low_discovery', 'reach→interest', f.reach, interestRate, t.healthyInterest, evidence);
  }

  // 2) Engagement — they open but don't go deep.
  if (deepRate < t.healthyDeep) {
    const evidence = [`${f.interest} opened`, `${f.highInterest} went deep (${pct(deepRate)})`];
    if (f.videoDeep !== undefined) evidence.push(`${f.videoDeep} video-deep`);
    if (f.arDeep !== undefined) evidence.push(`${f.arDeep} AR-deep`);
    return mediaMismatch(f, t)
      ? make('media_mismatch', 'interest→high', f.interest, deepRate, t.healthyDeep, evidence)
      : make('shallow_engagement', 'interest→high', f.interest, deepRate, t.healthyDeep, evidence);
  }

  // 3) Conversion — deep interest but no next step.
  if (intentRate < t.healthyIntent) {
    const revisits = f.revisits ?? 0;
    const evidence = [`${f.highInterest} high interest`, `${f.orderingIntent} intent (${pct(intentRate)})`];
    if (revisits > 0) evidence.push(`${revisits} revisits`);
    return revisits >= Math.max(5, f.highInterest * 0.4)
      ? make('consideration_stall', 'high→intent', f.highInterest, intentRate, t.healthyIntent, evidence)
      : make('weak_conversion', 'high→intent', f.highInterest, intentRate, t.healthyIntent, evidence);
  }

  return make('performing', 'none', f.reach, intentRate, t.healthyIntent, [
    `${f.reach} reach`,
    `${f.highInterest} high interest`,
    `${f.orderingIntent} intent (${pct(intentRate)})`,
  ]);
}

/**
 * Confidence in the DIAGNOSIS (not "AI confidence"):
 *  · sample — saturating with the bottleneck's denominator (~0.45@50, ~0.83@300, ~0.97@2000),
 *  · separation — how clearly the observed rate sits past the healthy threshold.
 * Same shape at reach 50 vs 50,000 ⇒ same diagnosis, very different confidence.
 */
function confidenceOf(diagnosis: Diagnosis, sampleN: number, observed: number, threshold: number): number {
  if (diagnosis === 'insufficient_data') return 0;
  const sample = sampleN <= 0 ? 0 : sampleN / (sampleN + 60);
  const separation =
    diagnosis === 'performing'
      ? clamp01((observed - threshold) / threshold) // how clearly ABOVE healthy
      : clamp01((threshold - observed) / threshold); // how clearly BELOW healthy
  return round2(Math.min(0.99, sample * (0.55 + 0.45 * separation)));
}

function mediaMismatch(f: FunnelShape, t: FunnelThresholds): boolean {
  if (f.videoDeep === undefined || f.arDeep === undefined) return false;
  const v = f.videoDeep, a = f.arDeep;
  if (v + a < t.mediaMinSample) return false;
  return Math.min(v, a) <= t.mediaImbalance * Math.max(v, a);
}
