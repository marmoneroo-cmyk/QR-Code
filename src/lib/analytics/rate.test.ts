import { describe, it, expect } from 'vitest';
import { confidentRate, hasConfidentSample, MIN_CONFIDENT_SAMPLE } from './rate';

describe('confidentRate', () => {
  it('refuses a rate below the confidence gate — the "100% from 2 views" trap', () => {
    const r = confidentRate(2, 2); // 100% ordered from 2 views
    expect(r.confident).toBe(false);
    expect(r.pct).toBe(100); // math is preserved…
    expect(r.sample).toBe(2); // …but the sample says don't trust it
  });

  it('trusts a rate once the denominator clears the gate', () => {
    const r = confidentRate(10, 50);
    expect(r.confident).toBe(true);
    expect(r.pct).toBe(20);
    expect(r.sample).toBe(50);
  });

  it('treats the gate as inclusive at exactly MIN_CONFIDENT_SAMPLE', () => {
    expect(confidentRate(5, MIN_CONFIDENT_SAMPLE).confident).toBe(true);
    expect(confidentRate(5, MIN_CONFIDENT_SAMPLE - 1).confident).toBe(false);
  });

  it('never divides by zero or reports a negative sample', () => {
    const zero = confidentRate(0, 0);
    expect(zero.pct).toBe(0);
    expect(zero.sample).toBe(0);
    expect(zero.confident).toBe(false);
    const neg = confidentRate(3, -5);
    expect(neg.sample).toBe(0);
    expect(neg.confident).toBe(false);
  });

  it('floors a fractional denominator so the sample is a whole count', () => {
    expect(confidentRate(1, 25.9).sample).toBe(25);
  });

  it('honors a custom gate', () => {
    expect(confidentRate(1, 5, 3).confident).toBe(true);
    expect(confidentRate(1, 2, 3).confident).toBe(false);
  });
});

describe('hasConfidentSample', () => {
  it('mirrors the gate for call sites that already hold the percentage', () => {
    expect(hasConfidentSample(MIN_CONFIDENT_SAMPLE)).toBe(true);
    expect(hasConfidentSample(MIN_CONFIDENT_SAMPLE - 1)).toBe(false);
    expect(hasConfidentSample(10, 8)).toBe(true);
  });
});
