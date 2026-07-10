// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useOrigin } from './useOrigin';

afterEach(cleanup);

describe('useOrigin', () => {
  it('returns the current window origin after mount', () => {
    const { result } = renderHook(() => useOrigin());
    expect(result.current).toBe(window.location.origin);
    expect(result.current).toMatch(/^https?:\/\//);
  });

  it('is referentially stable across re-renders (no useSyncExternalStore loop)', () => {
    const { result, rerender } = renderHook(() => useOrigin());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
