// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useNow } from './useNow';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useNow', () => {
  it('seeds the real clock after mount (render-pure, not called during render)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const { result } = renderHook(() => useNow());
    expect(result.current).toBe(1_000);
  });

  it('does not tick when no interval is given (seeded once)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    const { result } = renderHook(() => useNow());
    expect(result.current).toBe(5_000);
    vi.setSystemTime(9_999);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(5_000);
  });

  it('ticks on the given interval so "N ago" labels stay live', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const { result } = renderHook(() => useNow(1_000));
    expect(result.current).toBe(1_000);
    // Advancing the fake clock 1s from the 1_000 base fires the interval at t=2_000,
    // where the tick samples Date.now().
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(2_000);
  });
});
