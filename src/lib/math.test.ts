import { describe, it, expect } from 'vitest';
import { clamp01, median } from './math';

describe('clamp01', () => {
  it('clamps to [0, 1]', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1.7)).toBe(1);
  });
});

describe('median', () => {
  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0);
  });

  it('returns the middle value for odd length', () => {
    expect(median([3, 1, 2])).toBe(2); // sorted [1,2,3]
  });

  it('averages the two central values for even length', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5); // sorted [1,2,3,4] → (2+3)/2
  });

  it('does not mutate its input', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});
