// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useMenuOrder } from './useMenuOrder';

// The array-valued case through the shared useLocalStorageState primitive — verifies the
// snapshot cache keeps the array referentially stable (else useSyncExternalStore loops).
const KEY = 'cocktail-demo:menuOrder';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useMenuOrder (hook)', () => {
  it('defaults to an empty order and returns items unchanged', () => {
    const { result } = renderHook(() => useMenuOrder());
    expect(result.current.order).toEqual([]);
    const items = [{ slug: 'a' }, { slug: 'b' }];
    expect(result.current.apply(items)).toEqual(items);
  });

  it('hydrates a stored order and applies it', () => {
    localStorage.setItem(KEY, JSON.stringify(['b', 'a']));
    const { result } = renderHook(() => useMenuOrder());
    expect(result.current.order).toEqual(['b', 'a']);
    expect(result.current.apply([{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }]).map((x) => x.slug)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('setOrder persists and re-renders once (stable array snapshot, no loop)', () => {
    const { result } = renderHook(() => useMenuOrder());
    act(() => result.current.setOrder(['x', 'y']));
    expect(result.current.order).toEqual(['x', 'y']);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['x', 'y']);
    // Same order value across a re-read is the SAME reference (cache), proving stability.
    const first = result.current.order;
    const { result: second } = renderHook(() => useMenuOrder());
    expect(second.current.order).toBe(first);
  });

  it('ignores malformed stored JSON (falls back to empty)', () => {
    localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => useMenuOrder());
    expect(result.current.order).toEqual([]);
  });
});
