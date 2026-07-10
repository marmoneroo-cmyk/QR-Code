import { describe, it, expect } from 'vitest';
import { isValidSaleInput, MAX_SALES_ROWS } from './validate';

describe('isValidSaleInput', () => {
  it('accepts a fully-valid row', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: 10, revenue: 250 })).toBe(true);
  });

  it('accepts extra unknown keys on the row (not a whitelist)', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: 10, revenue: 250, category: 'cocktails' })).toBe(true);
  });

  it('accepts zero units and revenue (the lower bound is inclusive)', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: 0, revenue: 0 })).toBe(true);
  });

  it('rejects negative units (would corrupt revenue analytics)', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: -1, revenue: 250 })).toBe(false);
  });

  it('rejects negative revenue (would corrupt revenue analytics)', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: 10, revenue: -5 })).toBe(false);
  });

  it('rejects non-object rows', () => {
    expect(isValidSaleInput(null)).toBe(false);
    expect(isValidSaleInput('margarita')).toBe(false);
    expect(isValidSaleInput(5)).toBe(false);
  });

  it('rejects a missing slug', () => {
    expect(isValidSaleInput({ units: 10, revenue: 250 })).toBe(false);
  });

  it('rejects a non-string slug', () => {
    expect(isValidSaleInput({ slug: 5, units: 10, revenue: 250 })).toBe(false);
  });

  it('rejects an empty or whitespace-only slug', () => {
    expect(isValidSaleInput({ slug: '', units: 10, revenue: 250 })).toBe(false);
    expect(isValidSaleInput({ slug: '   ', units: 10, revenue: 250 })).toBe(false);
  });

  it('rejects a non-number units', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: '10', revenue: 250 })).toBe(false);
  });

  it('rejects a non-finite units (NaN or Infinity)', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: NaN, revenue: 250 })).toBe(false);
    expect(isValidSaleInput({ slug: 'margarita', units: Infinity, revenue: 250 })).toBe(false);
  });

  it('rejects a non-number revenue', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: 10, revenue: '250' })).toBe(false);
  });

  it('rejects a non-finite revenue (NaN or Infinity)', () => {
    expect(isValidSaleInput({ slug: 'margarita', units: 10, revenue: NaN })).toBe(false);
    expect(isValidSaleInput({ slug: 'margarita', units: 10, revenue: -Infinity })).toBe(false);
  });

  it('rejects a missing units or revenue field', () => {
    expect(isValidSaleInput({ slug: 'margarita', revenue: 250 })).toBe(false);
    expect(isValidSaleInput({ slug: 'margarita', units: 10 })).toBe(false);
  });
});

describe('MAX_SALES_ROWS', () => {
  it('is the 1000-row cap the route enforces on POST', () => {
    expect(MAX_SALES_ROWS).toBe(1000);
  });

  it('documents the boundary: length === cap is fine, length > cap is not', () => {
    const atCap = Array.from({ length: MAX_SALES_ROWS });
    const overCap = Array.from({ length: MAX_SALES_ROWS + 1 });
    expect(atCap.length > MAX_SALES_ROWS).toBe(false);
    expect(overCap.length > MAX_SALES_ROWS).toBe(true);
  });
});
