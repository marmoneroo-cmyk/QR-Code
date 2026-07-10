import { describe, it, expect } from 'vitest';
import { formatILS } from './format';

/** The one shared ₪ formatter — 7 screens depend on it, so lock its rounding + prefix. */
describe('formatILS', () => {
  it('prefixes ₪ and shows whole shekels', () => {
    expect(formatILS(0)).toBe('₪0');
    expect(formatILS(999)).toBe('₪999');
  });

  it('rounds to the nearest whole shekel (no fractional agorot)', () => {
    // Separator-agnostic (locale may render thousands differently in some environments).
    expect(formatILS(1234.6).replace(/,/g, '')).toBe('₪1235');
    expect(formatILS(1234.4).replace(/,/g, '')).toBe('₪1234');
  });

  it('groups thousands', () => {
    // At least one grouping separator appears for a 4-digit value.
    expect(formatILS(1234).length).toBeGreaterThan('₪1234'.length);
    expect(formatILS(1234).replace(/[^0-9₪]/g, '')).toBe('₪1234');
  });

  it('handles negative amounts', () => {
    expect(formatILS(-5)).toBe('₪-5');
  });
});
