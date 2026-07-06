import type { MeasureInput, MeasureOptions, ImpactResult } from './types';

/**
 * Measure the impact of a change by comparing the watched metric in a COMPLETE
 * pre window vs a COMPLETE, equal-length post window.
 *
 * Honest-measurement gates (no fabricated wins):
 * - too_early: the post window has not fully elapsed yet — comparing a partial
 *   post window against a full pre window is what let a volume *drop* read as a
 *   "+% win", so we refuse to conclude until the windows are equal length.
 * - insufficient_data: either side lacks a real sample (a zero/tiny baseline
 *   cannot yield a trustworthy lift — that was the zero-baseline false win).
 * - no_effect: change is within the noise band OR below the minimum absolute delta.
 * - otherwise success / declined with a real, equal-window delta.
 *
 * NOTE: this is correlation, not causal revenue. The metric is distinct-session
 * engagement counts; there is no sales attribution here by design.
 */
export function measureImpact(input: MeasureInput, opts: MeasureOptions = {}): ImpactResult {
  const W = opts.windowDays ?? 7;
  const minSample = opts.minSample ?? 12;
  const minPerArm = opts.minPerArm ?? 6;
  const minAbsDelta = opts.minAbsDelta ?? 5;
  const band = opts.noEffectBandPct ?? 10;
  const { before, after, daysSince } = input;

  // 1) Need a COMPLETE, equal-length post window before any verdict.
  if (daysSince < W) {
    return { status: 'too_early', deltaPct: null, direction: null };
  }
  // 2) Need a real baseline AND a real post sample on BOTH sides.
  if (before < minPerArm || after < minPerArm || before + after < minSample) {
    return { status: 'insufficient_data', deltaPct: null, direction: null };
  }

  // Equal windows ⇒ a plain count comparison is the honest delta.
  const deltaPct = Math.round(((after - before) / before) * 100);
  const absDelta = Math.abs(after - before);
  if (Math.abs(deltaPct) < band || absDelta < minAbsDelta) {
    return { status: 'no_effect', deltaPct, direction: 'flat' };
  }
  return deltaPct > 0
    ? { status: 'success', deltaPct, direction: 'up' }
    : { status: 'declined', deltaPct, direction: 'down' };
}
