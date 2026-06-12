import { describe, it, expect } from 'vitest';
import { diagnoseFunnel, ENGINE_VERSION, type Diagnosis, type FunnelShape } from './funnel';
import { thresholdsFor } from './thresholds';
import { SCENARIOS } from './scenarios';

const KNOWN: ReadonlySet<Diagnosis> = new Set<Diagnosis>([
  'insufficient_data', 'low_discovery', 'exposure_gap', 'shallow_engagement',
  'media_mismatch', 'consideration_stall', 'weak_conversion', 'performing',
]);

describe('AI Coach — funnel diagnosis scenarios', () => {
  for (const s of SCENARIOS) {
    it(`${s.name} → ${s.expected}`, () => {
      const r = diagnoseFunnel(s.funnel);
      const msg = `${s.name} (${s.note}); conf=${r.confidence}; rates=${JSON.stringify(r.rates)}`;
      expect(r.diagnosis, msg).toBe(s.expected);
      expect(KNOWN.has(r.diagnosis)).toBe(true);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(0.99);
      expect(r.evidence.length).toBeGreaterThan(0);
    });
  }

  it('has at least 50 scenarios', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(50);
  });
});

describe('AI Coach — diagnosis confidence (sample size + separation)', () => {
  const scale = (f: FunnelShape, k: number): FunnelShape => ({
    reach: f.reach * k, interest: f.interest * k, highInterest: f.highInterest * k, orderingIntent: f.orderingIntent * k,
    ...(f.videoDeep !== undefined ? { videoDeep: f.videoDeep * k } : {}),
    ...(f.arDeep !== undefined ? { arDeep: f.arDeep * k } : {}),
    ...(f.revisits !== undefined ? { revisits: f.revisits * k } : {}),
  });

  it('keeps the DIAGNOSIS scale-invariant but raises CONFIDENCE with sample', () => {
    const base: FunnelShape = { reach: 100, interest: 90, highInterest: 80, orderingIntent: 2 }; // weak_conversion
    const r1 = diagnoseFunnel(base);
    const r10 = diagnoseFunnel(scale(base, 10));
    const r100 = diagnoseFunnel(scale(base, 100));
    expect([r1.diagnosis, r10.diagnosis, r100.diagnosis]).toEqual(['weak_conversion', 'weak_conversion', 'weak_conversion']);
    expect(r10.confidence).toBeGreaterThan(r1.confidence);
    expect(r100.confidence).toBeGreaterThanOrEqual(r10.confidence);
  });

  it("owner's example: same shape, reach 50 vs 50,000 → far more confidence at scale", () => {
    const small = diagnoseFunnel({ reach: 50, interest: 40, highInterest: 30, orderingIntent: 2 });
    const big = diagnoseFunnel({ reach: 50000, interest: 40000, highInterest: 30000, orderingIntent: 2000 });
    expect(small.diagnosis).toBe('weak_conversion');
    expect(big.diagnosis).toBe('weak_conversion');
    expect(big.confidence).toBeGreaterThan(small.confidence + 0.3);
  });

  it('gives insufficient_data zero diagnosis confidence', () => {
    expect(diagnoseFunnel({ reach: 10, interest: 8, highInterest: 5, orderingIntent: 2 }).confidence).toBe(0);
  });

  it('attaches evidence to every verdict', () => {
    for (const s of SCENARIOS) expect(diagnoseFunnel(s.funnel).evidence.length).toBeGreaterThan(0);
  });

  it('respects external thresholds (a looser config flips the verdict)', () => {
    const f: FunnelShape = { reach: 1000, interest: 250, highInterest: 60, orderingIntent: 20 };
    expect(diagnoseFunnel(f).diagnosis).toBe('low_discovery'); // default cut-points
    const loose = diagnoseFunnel(f, { minReach: 30, healthyInterest: 0.2, healthyDeep: 0.2, healthyIntent: 0.05, mediaMinSample: 8, mediaImbalance: 0.25 });
    expect(loose.diagnosis).toBe('performing'); // looser bars ⇒ same data now reads as healthy
  });
});

describe('AI Coach — recommendation provenance (the auditable "why")', () => {
  const sample: FunnelShape = { reach: 1000, interest: 250, highInterest: 60, orderingIntent: 20 };

  it('stamps every verdict with engine version, threshold profile, confidence and a snapshot', () => {
    for (const s of SCENARIOS) {
      const p = diagnoseFunnel(s.funnel).provenance;
      expect(p.engineVersion, s.name).toBe(ENGINE_VERSION);
      expect(p.thresholdProfile, s.name).toBe('default_v1'); // default cut-points
      expect(p.recommendationId, s.name).toMatch(/^rec_[0-9a-z]+$/);
      expect(p.confidence, s.name).toBe(diagnoseFunnel(s.funnel).confidence);
    }
  });

  it('freezes the exact funnel counts the verdict was computed from', () => {
    const f: FunnelShape = { reach: 1000, interest: 250, highInterest: 60, orderingIntent: 20, videoDeep: 40, arDeep: 8, revisits: 12 };
    const snap = diagnoseFunnel(f).provenance.evidenceSnapshot;
    expect(snap).toEqual({ reach: 1000, interest: 250, highInterest: 60, orderingIntent: 20, videoDeep: 40, arDeep: 8, revisits: 12 });
  });

  it('records the category-specific threshold profile when one is used', () => {
    const cocktail = thresholdsFor('cocktail'); // empty override map today ⇒ default profile
    expect(diagnoseFunnel(sample, { ...cocktail, profile: 'cocktail_v1' }).provenance.thresholdProfile).toBe('cocktail_v1');
  });

  it('is content-addressed: same shape ⇒ same id, changed shape ⇒ changed id', () => {
    const a = diagnoseFunnel(sample).provenance.recommendationId;
    const aAgain = diagnoseFunnel({ ...sample }).provenance.recommendationId;
    const moved = diagnoseFunnel({ ...sample, orderingIntent: 200 }).provenance.recommendationId;
    expect(a).toBe(aAgain);          // deterministic — no clock, no randomness
    expect(moved).not.toBe(a);       // a genuinely different verdict gets a new id
  });

  it('ties the id to the engine version (a new engine ⇒ a new id for the same data)', () => {
    // Same shape under a different profile must not collide — the profile is part of the id.
    const def = diagnoseFunnel(sample).provenance.recommendationId;
    const alt = diagnoseFunnel(sample, { ...thresholdsFor(), profile: 'cocktail_v1' }).provenance.recommendationId;
    expect(alt).not.toBe(def);
  });
});
