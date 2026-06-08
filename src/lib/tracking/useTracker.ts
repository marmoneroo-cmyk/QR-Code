'use client';

import { useEffect, useRef } from 'react';
import { track } from './track';
import type { TrackPayload } from './taxonomy';

/**
 * useTracker — returns the stable `track` function for imperative event firing
 * (clicks, toggles). `track` is a module singleton, so this is just a typed,
 * convenient handle.
 */
export function useTracker(): { track: (payload: TrackPayload) => void } {
  return { track };
}

/**
 * useTrackOnce — fire a single event once when `key` becomes truthy/changes
 * (e.g. a page mount or a cocktail slug appearing). Guards React 18 double-mount.
 */
export function useTrackOnce(payload: TrackPayload, key: string | number = 'mount'): void {
  const firedFor = useRef<string | number | null>(null);
  useEffect(() => {
    if (firedFor.current === key) return;
    firedFor.current = key;
    track(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
