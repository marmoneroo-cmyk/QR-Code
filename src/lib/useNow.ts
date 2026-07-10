'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Current wall-clock time in ms as render-safe reactive state — the shared replacement for
 * calling `Date.now()` during render (which React 19's purity rule flags, since render must be
 * deterministic, and which also risks a server/client hydration mismatch).
 *
 * Built on useSyncExternalStore (the same idiom as useLocalStorageState) rather than
 * useState + effect, so there's no set-state-in-effect and no impure render: the clock is
 * sampled in `subscribe` (after commit) and read from a stable ref in `getSnapshot`. Seeded
 * once after mount; when `intervalMs` is given it re-samples on that cadence so "N ago" labels
 * stay live. SSR-safe: getServerSnapshot returns 0, so the server and first client render agree
 * (treat 0 as "not measured yet"), then the real clock takes over after hydration.
 */
export function useNow(intervalMs?: number): number {
  const sampled = useRef(0);

  const subscribe = useCallback(
    (onChange: () => void) => {
      sampled.current = Date.now();
      onChange();
      if (!intervalMs) return () => {};
      const id = window.setInterval(() => {
        sampled.current = Date.now();
        onChange();
      }, intervalMs);
      return () => window.clearInterval(id);
    },
    [intervalMs],
  );

  return useSyncExternalStore(
    subscribe,
    () => sampled.current,
    () => 0,
  );
}
