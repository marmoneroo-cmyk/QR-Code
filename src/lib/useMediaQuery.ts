'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe media query hook. Returns false on the server and first client
 * render, then updates after mount — so layouts that depend on it must
 * tolerate a one-frame desktop-first render (avoids hydration mismatch).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True on phones / small tablets (< 1024px), where the immersive 3-zone
 *  desktop layout doesn't fit and a scrollable layout is used instead. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
