import { describe, it, expect } from 'vitest';
import { deltaPct } from './dataviz';

describe('deltaPct', () => {
  it('returns null when there is not enough history (<8 points)', () => {
    expect(deltaPct(undefined)).toBeNull();
    expect(deltaPct([])).toBeNull();
    expect(deltaPct([1, 2, 3, 4, 5, 6, 7])).toBeNull();
  });

  it('computes week-over-week percent change (last 7 vs prior 7)', () => {
    // prior 7 sum = 7, last 7 sum = 14 → +100%
    expect(deltaPct([1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2])).toBe(100);
  });

  it('handles a decline', () => {
    // prior 7 sum = 14, last 7 sum = 7 → -50%
    expect(deltaPct([2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1])).toBe(-50);
  });

  it('returns null when the prior week is zero (no baseline to divide by)', () => {
    expect(deltaPct([0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 5])).toBeNull();
  });

  it('rounds to an integer', () => {
    // prior 7 sum = 7, last 7 sum = 8 → 14.285% → 14
    expect(deltaPct([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2])).toBe(14);
  });

  it('uses only the most recent 14 points when given a longer series', () => {
    // leading noise should be ignored; trailing 14 → prior 7 = 7, last 7 = 14 → +100%
    expect(deltaPct([99, 99, 99, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2])).toBe(100);
  });
});
