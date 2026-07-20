import { describe, it, expect } from 'vitest';
import { parseCsv } from './parseCsv';
import { isValidSaleInput, MAX_SLUG_LEN } from './validate';

describe('parseCsv header detection does not eat real rows', () => {
  it('keeps an item whose slug merely STARTS WITH "slug"', () => {
    const parsed = parseCsv('slug-sipper,3,100\nmojito,2,50');
    expect(parsed.rows.map((r) => r.slug)).toEqual(['slug-sipper', 'mojito']);
    expect(parsed.skipped).toBe(0);
  });

  it('still strips a genuine header row', () => {
    const parsed = parseCsv('slug,units,revenue\nmojito,2,50');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.slug).toBe('mojito');
  });

  it('strips a tab-separated header row too', () => {
    const parsed = parseCsv('slug\tunits\trevenue\nmojito\t2\t50');
    expect(parsed.rows).toHaveLength(1);
  });

  it('only treats the FIRST line as a possible header', () => {
    const parsed = parseCsv('mojito,2,50\nslug-sipper,1,10');
    expect(parsed.rows).toHaveLength(2);
  });

  it('still counts genuinely malformed rows as skipped', () => {
    const parsed = parseCsv('mojito,abc,50\nnegroni,1,-5');
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.skipped).toBe(2);
  });

  it('keeps treating an empty numeric cell as 0', () => {
    const parsed = parseCsv('mojito,,4200');
    expect(parsed.rows[0]).toEqual({ slug: 'mojito', units: 0, revenue: 4200 });
  });
});

describe('isValidSaleInput bounds the persisted slug', () => {
  const row = (slug: string) => ({ slug, units: 1, revenue: 10 });

  it('accepts a normal slug', () => {
    expect(isValidSaleInput(row('mojito'))).toBe(true);
    expect(isValidSaleInput(row('x'.repeat(MAX_SLUG_LEN)))).toBe(true);
  });

  it('rejects an over-long slug', () => {
    expect(isValidSaleInput(row('x'.repeat(MAX_SLUG_LEN + 1)))).toBe(false);
  });

  it('still rejects the existing invalid shapes', () => {
    expect(isValidSaleInput(row(''))).toBe(false);
    expect(isValidSaleInput({ slug: 'a', units: -1, revenue: 0 })).toBe(false);
    expect(isValidSaleInput({ slug: 'a', units: NaN, revenue: 0 })).toBe(false);
    expect(isValidSaleInput(null)).toBe(false);
  });
});
