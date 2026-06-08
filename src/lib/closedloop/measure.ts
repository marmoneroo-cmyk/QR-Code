import type { MeasureInput, MeasureOptions, ImpactResult } from './types';

/**
 * Measure the impact of a change by comparing per-day metric rates before vs after.
 * Uses per-day rates so a partial post-window (change made 3 days ago, W=7) is
 * compared fairly against the full pre-window.
 *
 * Integrity gate:
 * - too_early: not enough days have elapsed to judge.
 * - insufficient_data: too little total signal to trust a number.
 * - otherwise success / declined / no_effect with a real delta.
 */
export function measureImpact(input: MeasureInput, opts: MeasureOptions = {}): ImpactResult {
  const W = opts.windowDays ?? 7;
  const minSample = opts.minSample ?? 8;
  const band = opts.noEffectBandPct ?? 10;
  const { before, after, daysSince } = input;

  if (daysSince < Math.min(2, W)) {
    return { status: 'too_early', deltaPct: null, direction: null };
  }
  if (before + after < minSample) {
    return { status: 'insufficient_data', deltaPct: null, direction: null };
  }

  const afterDays = Math.max(1, Math.min(daysSince, W));
  const beforeRate = before / W;
  const afterRate = after / afterDays;

  // No baseline: can't compute a %, but post-activity is a positive signal.
  if (beforeRate === 0) {
    if (after >= minSample) return { status: 'success', deltaPct: null, direction: 'up' };
    return { status: 'insufficient_data', deltaPct: null, direction: null };
  }

  const deltaPct = Math.round(((afterRate - beforeRate) / beforeRate) * 100);
  if (Math.abs(deltaPct) < band) return { status: 'no_effect', deltaPct, direction: 'flat' };
  if (deltaPct > 0) return { status: 'success', deltaPct, direction: 'up' };
  return { status: 'declined', deltaPct, direction: 'down' };
}
