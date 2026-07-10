import { describe, it, expect } from 'vitest';
import { isFresh } from './useReadiness';

/** The shared-cache freshness gate that prevents redundant heavy /api/signals/verify scans. */
describe('useReadiness cache — isFresh', () => {
  it('treats a missing cache entry as never fresh', () => {
    expect(isFresh(null, 1_000_000)).toBe(false);
  });

  it('is fresh within the 5-minute TTL', () => {
    const entry = { at: 1_000_000, value: null };
    expect(isFresh(entry, 1_000_000)).toBe(true); // same instant
    expect(isFresh(entry, 1_000_000 + 4 * 60 * 1000)).toBe(true); // 4 min later
  });

  it('is stale once the TTL lapses', () => {
    const entry = { at: 1_000_000, value: null };
    expect(isFresh(entry, 1_000_000 + 5 * 60 * 1000)).toBe(false); // exactly at TTL
    expect(isFresh(entry, 1_000_000 + 10 * 60 * 1000)).toBe(false);
  });
});
