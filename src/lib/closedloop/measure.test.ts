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

  it('refuses a verdict until the post window is complete (no partial-window false win)', () => {
    // Regression: a volume DROP (14 → 10) used to read as "+67% success" because a
    // partial 3-day post window was compared to a full 7-day pre window.
    expect(measureImpact({ before: 14, after: 10, daysSince: 3 }).status).toBe('too_early');
  });

  it('a small absolute drop (14 → 10) is no_effect, never a win', () => {
    // Only 4 sessions of movement — below minAbsDelta; honest engine refuses a verdict either way.
    expect(measureImpact({ before: 14, after: 10, daysSince: 7 }).status).toBe('no_effect');
  });

  it('reports a genuine decline once the full window elapses', () => {
    const r = measureImpact({ before: 20, after: 12, daysSince: 7 });
    expect(r.status).toBe('declined');
    expect(r.deltaPct).toBe(-40);
  });

  it('refuses a zero/tiny baseline as a win (no fabricated success)', () => {
    // Regression: before=0 with post activity used to be auto-"success".
    expect(measureImpact({ before: 0, after: 12, daysSince: 7 }).status).toBe('insufficient_data');
    expect(measureImpact({ before: 3, after: 12, daysSince: 7 }).status).toBe('insufficient_data');
  });

  it('treats a tiny absolute change as no_effect even if the % looks large', () => {
    // 6 → 9 is +50% but only 3 sessions of movement — noise, not a win.
    expect(measureImpact({ before: 6, after: 9, daysSince: 7 }).status).toBe('no_effect');
  });
});
