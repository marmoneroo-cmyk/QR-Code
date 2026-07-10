'use client';

import { useEffect, useState } from 'react';

/** Dataset-readiness slice from `/api/signals/verify` — drives the honesty caveat. */
export type Readiness = {
  ready: boolean;
  consecutiveReadyDays: number;
  requiredDays: number;
  blockedBy: string[];
};

/**
 * Fetch dataset readiness ONCE (it changes daily, so it needs no polling) for the
 * honesty caveat shown on engine-claim surfaces (Coach, Action Center, Executive…).
 * Best-effort: fails open (returns `null`) so a signal-verification hiccup never blocks
 * or breaks the surface. Runs off any page's primary poll so the scan is never on the
 * critical render path.
 */
export function useReadiness(): Readiness | null {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/signals/verify', { cache: 'no-store' });
        const json: { success: boolean; data?: { readiness?: Readiness } } = await res.json();
        if (!cancelled) setReadiness(json.success && json.data?.readiness ? json.data.readiness : null);
      } catch {
        /* best-effort — fail open */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return readiness;
}
