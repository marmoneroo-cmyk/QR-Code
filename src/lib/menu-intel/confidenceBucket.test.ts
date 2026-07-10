import { describe, it, expect } from 'vitest';
import { confidenceBucket } from './thresholds';

/**
 * The one shared confidence bucket — both the opportunities engine (default minSample 10)
 * and the optimization engine (default 30) route through it, so lock the boundaries.
 */
describe('confidenceBucket', () => {
  it('is low below the minimum sample', () => {
    expect(confidenceBucket(0, 10)).toBe('low');
    expect(confidenceBucket(9, 10)).toBe('low');
  });

  it('is medium at the minimum, high at 3× the minimum (inclusive boundaries)', () => {
    expect(confidenceBucket(10, 10)).toBe('medium');
    expect(confidenceBucket(29, 10)).toBe('medium');
    expect(confidenceBucket(30, 10)).toBe('high'); // 3 × 10
  });

  it('scales with the caller-supplied minSample (the two engines differ by design)', () => {
    expect(confidenceBucket(29, 30)).toBe('low');
    expect(confidenceBucket(30, 30)).toBe('medium');
    expect(confidenceBucket(90, 30)).toBe('high'); // 3 × 30
  });

  it('documents the divergent-default contradiction the audit found: 25 views', () => {
    // Same sample, different engine defaults → intentionally different bucket today.
    expect(confidenceBucket(25, 10)).toBe('medium'); // opportunities engine
    expect(confidenceBucket(25, 30)).toBe('low'); // optimization engine
  });
});
