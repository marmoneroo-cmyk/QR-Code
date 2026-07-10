'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * SSR-safe media query hook via useSyncExternalStore (React's canonical pattern for
 * external browser state). Returns false on the server and first client render, then the
 * real match after mount — layouts that depend on it must tolerate a one-frame
 * desktop-first render (avoids hydration mismatch). The boolean snapshot is a stable
 * primitive, so there is no re-render loop.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True on phones / small tablets (< 1024px), where the immersive 3-zone
 *  desktop layout doesn't fit and a scrollable layout is used instead. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
