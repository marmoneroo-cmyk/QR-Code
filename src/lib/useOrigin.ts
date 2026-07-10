'use client';

import { useSyncExternalStore } from 'react';

/**
 * The current page origin (e.g. "https://menu.example.com"), SSR-safe. Returns '' on the server
 * and the first client render — so absolute-URL builders can guard with `if (!origin) return` —
 * then the real origin after hydration. Built on useSyncExternalStore (the same idiom as the
 * app's other browser-read hooks: useLocalStorageState / useMediaQuery / useNow), so there is no
 * set-state-in-effect and no impure render.
 *
 * The origin is constant for a page's lifetime, so there's nothing to subscribe to: the snapshot
 * is a stable string that never changes after mount.
 */
const subscribe = (): (() => void) => () => {};
const getSnapshot = (): string => (typeof window === 'undefined' ? '' : window.location.origin);
const getServerSnapshot = (): string => '';

export function useOrigin(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
