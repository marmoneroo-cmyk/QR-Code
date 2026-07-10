// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useOppStatuses } from './useOppStatuses';
import { __resetLocalStorageCache } from './useLocalStorageState';

const KEY = 'cocktail-demo:opps';

beforeEach(() => {
  localStorage.clear();
  __resetLocalStorageCache();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  __resetLocalStorageCache();
});

describe('useOppStatuses', () => {
  it('defaults to an empty map', () => {
    const { result } = renderHook(() => useOppStatuses());
    expect(result.current.statuses).toEqual({});
  });

  it('markDone persists a done status to the shared key', () => {
    const { result } = renderHook(() => useOppStatuses());
    act(() => result.current.markDone('a:promo'));
    expect(result.current.statuses['a:promo']).toEqual({ status: 'done' });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ 'a:promo': { status: 'done' } });
  });

  it('setStatus snoozed carries a future `until`', () => {
    const { result } = renderHook(() => useOppStatuses());
    const before = Date.now();
    act(() => result.current.setStatus('b:layout', 'snoozed'));
    const entry = result.current.statuses['b:layout'];
    expect(entry.status).toBe('snoozed');
    expect(typeof entry.until).toBe('number');
    expect(entry.until!).toBeGreaterThan(before);
  });

  it('clearStatus removes an entry (undo)', () => {
    const { result } = renderHook(() => useOppStatuses());
    act(() => result.current.markDone('c:x'));
    expect(result.current.statuses['c:x']).toBeDefined();
    act(() => result.current.clearStatus('c:x'));
    expect(result.current.statuses['c:x']).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({});
  });

  it('hydrates an existing status map from localStorage', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'd:y': { status: 'dismissed' } }));
    const { result } = renderHook(() => useOppStatuses());
    expect(result.current.statuses).toEqual({ 'd:y': { status: 'dismissed' } });
  });

  it('tolerates corrupt JSON by falling back to empty', () => {
    localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => useOppStatuses());
    expect(result.current.statuses).toEqual({});
  });
});
