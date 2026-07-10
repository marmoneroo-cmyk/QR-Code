// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCurrency } from './useCurrency';

const STORAGE_KEY = 'cocktail-demo:currency';

// renderHook mounts a component, so unmount it between tests; and clear the shared
// localStorage so one test's stored value can't leak into the next (order-independence).
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useCurrency', () => {
  it('defaults to ILS when nothing is stored', () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.currency).toBe('ILS');
  });

  it('hydrates from localStorage when a valid currency is pre-set', () => {
    localStorage.setItem(STORAGE_KEY, 'USD');
    const { result } = renderHook(() => useCurrency());
    // The mount effect reads storage and updates state, flushed by renderHook's act().
    expect(result.current.currency).toBe('USD');
  });

  it('ignores an invalid stored value and stays on ILS', () => {
    localStorage.setItem(STORAGE_KEY, 'GBP'); // not one of ILS/USD/EUR
    const { result } = renderHook(() => useCurrency());
    expect(result.current.currency).toBe('ILS');
  });

  it('setCurrency updates the returned value AND writes localStorage', () => {
    const { result } = renderHook(() => useCurrency());
    act(() => result.current.setCurrency('USD'));
    expect(result.current.currency).toBe('USD');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('USD');
  });
});
