import { describe, it, expect } from 'vitest';
import { measureImpact } from './measure';

describe('measureImpact', () => {
  it('is too_early before enough days elapse', () => {
    expect(measureImpact({ before: 20, after: 30, daysSince: 1 }).status).toBe('too_early');
  });

  it('is insufficient_data with too little signal', () => {
    expect(measureImpact({ before: 2, after: 3, daysSince: 7 }).status).toBe('insufficient_data');
  });

  it('reports success on a real positive lift', () => {
    const r = measureImpact({ before: 10, after: 20, daysSince: 7 });
    expect(r.status).toBe('success');
    expect(r.direction).toBe('up');
    expect(r.deltaPct).toBe(100);
  });

  it('reports declined on a real drop', () => {
    const r = measureImpact({ before: 20, after: 10, daysSince: 7 });
    expect(r.status).toBe('declined');
    expect(r.deltaPct).toBe(-50);
  });

  it('reports no_effect within the band', () => {
    const r = measureImpact({ before: 20, after: 21, daysSince: 7 });
    expect(r.status).toBe('no_effect');
    expect(r.direction).toBe('flat');
  });

  it('scales a partial post-window fairly (per-day rates)', () => {
    // before 14 over 7d = 2/day; after 10 over 3d = 3.33/day → +66%
    const r = measureImpact({ before: 14, after: 10, daysSince: 3 });
    expect(r.status).toBe('success');
    expect(r.deltaPct).toBe(67);
  });

  it('treats a zero baseline with real post-activity as success (no fabricated %)', () => {
    const r = measureImpact({ before: 0, after: 12, daysSince: 7 });
    expect(r.status).toBe('success');
    expect(r.deltaPct).toBeNull();
    expect(r.direction).toBe('up');
  });
});
