import { describe, it, expect } from 'vitest';
import { diagnoseFunnel, type Diagnosis } from './funnel';
import { SCENARIOS } from './scenarios';

const KNOWN: ReadonlySet<Diagnosis> = new Set<Diagnosis>([
  'insufficient_data', 'low_discovery', 'exposure_gap', 'shallow_engagement',
  'media_mismatch', 'consideration_stall', 'weak_conversion', 'performing',
]);

describe('AI Coach — funnel diagnosis (30 synthetic scenarios)', () => {
  for (const s of SCENARIOS) {
    it(`${s.name} → ${s.expected}`, () => {
      const r = diagnoseFunnel(s.funnel);
      expect(r.diagnosis, `${s.name} (${s.note}); rates=${JSON.stringify(r.rates)}`).toBe(s.expected);
    });
  }

  it('has 30 scenarios', () => {
    expect(SCENARIOS.length).toBe(30);
  });

  it('always returns a known diagnosis and never throws', () => {
    for (const s of SCENARIOS) {
      expect(KNOWN.has(diagnoseFunnel(s.funnel).diagnosis)).toBe(true);
    }
  });
});
