import { describe, it, expect } from 'vitest';
import { sampleConfidence, SAMPLE_SATURATION } from './sample';

describe('sampleConfidence — the shared trust-in-sample curve', () => {
  it('is 0 for a non-positive sample', () => {
    expect(sampleConfidence(0)).toBe(0);
    expect(sampleConfidence(-5)).toBe(0);
  });

  it('reaches exactly 0.5 at the saturation constant', () => {
    expect(sampleConfidence(SAMPLE_SATURATION)).toBeCloseTo(0.5, 6);
  });

  it('matches the reference points the engine comments promise', () => {
    expect(sampleConfidence(50)).toBeCloseTo(50 / 110, 6); // ~0.45
    expect(sampleConfidence(300)).toBeCloseTo(300 / 360, 6); // ~0.83
    expect(sampleConfidence(2000)).toBeCloseTo(2000 / 2060, 6); // ~0.97
  });

  it('is strictly monotonic and never reaches 1', () => {
    expect(sampleConfidence(300)).toBeGreaterThan(sampleConfidence(50));
    expect(sampleConfidence(2000)).toBeGreaterThan(sampleConfidence(300));
    expect(sampleConfidence(1e9)).toBeLessThan(1);
  });
});
