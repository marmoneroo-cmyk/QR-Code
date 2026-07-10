// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useMediaQuery, useIsMobile } from './useMediaQuery';

// Unmount hooks between tests (no vitest globals set → Testing Library's auto-cleanup
// isn't registered, so do it explicitly or subscriptions/DOM leak across tests).
afterEach(cleanup);

/**
 * jsdom ships no `window.matchMedia`, and the hook now uses `useSyncExternalStore` — so we
 * install a controllable fake: a single MediaQueryList-like object (shared by the hook's
 * `subscribe` and `getSnapshot` calls) whose `matches` is mutable and whose 'change'
 * listeners we can fire on demand. The global is restored after each test.
 */
const realMatchMedia = window.matchMedia;

function installMatchMedia(initialMatches: boolean) {
  const state = { matches: initialMatches };
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    get matches() {
      return state.matches;
    },
    media: '',
    onchange: null,
    addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => {
      listeners.delete(cb);
    },
    // legacy Safari API, present for completeness
    addListener: (cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeListener: (cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
    dispatchEvent: () => true,
  };
  const matchMedia = vi.fn((query: string) => {
    mql.media = query;
    return mql;
  });
  // @ts-expect-error jsdom has no matchMedia; install our fake for the test.
  window.matchMedia = matchMedia;
  const fireChange = (matches: boolean) => {
    state.matches = matches;
    listeners.forEach((cb) => cb({ matches }));
  };
  return { matchMedia, fireChange };
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('useMediaQuery', () => {
  it('returns the current match value from window.matchMedia', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when the query does not match', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(result.current).toBe(false);
  });

  it('updates when the media query list dispatches a change event', () => {
    const { fireChange } = installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(result.current).toBe(false);

    act(() => fireChange(true));
    expect(result.current).toBe(true);
  });
});

describe('useIsMobile', () => {
  it('queries the (max-width: 1023px) breakpoint', () => {
    const { matchMedia } = installMatchMedia(false);
    renderHook(() => useIsMobile());
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 1023px)');
  });

  it('reflects the match result for that breakpoint', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
