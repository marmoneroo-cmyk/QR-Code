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
 * `/api/signals/verify` runs a heavy scan (up to 50k events). Readiness changes only
 * ~daily, yet several engine surfaces (Coach, Action Center, Executive) each want it, so
 * a naive per-mount fetch would re-run that scan on every navigation. This module-level
 * cache + in-flight dedup means the whole browsing session shares ONE fetch until the TTL
 * lapses — the perf counterpart of the shared `ReadinessNote` UI (one Business Brain).
 */
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: Readiness | null } | null = null;
let inflight: Promise<Readiness | null> | null = null;

async function fetchReadiness(): Promise<Readiness | null> {
  try {
    const res = await fetch('/api/signals/verify', { cache: 'no-store' });
    const json: { success: boolean; data?: { readiness?: Readiness } } = await res.json();
    return json.success && json.data?.readiness ? json.data.readiness : null;
  } catch {
    return null; // best-effort — fail open
  }
}

/** True when the cache is present and still within its TTL. `now` is injectable for tests. */
export function isFresh(entry: typeof cache, now: number): boolean {
  return entry !== null && now - entry.at < TTL_MS;
}

/**
 * Read dataset readiness for the honesty caveat. Fails open (returns `null`). Shares one
 * fetch across all callers via the module cache, so switching between engine surfaces
 * never re-triggers the signal-verification scan within the TTL.
 */
export function useReadiness(): Readiness | null {
  const [readiness, setReadiness] = useState<Readiness | null>(() => cache?.value ?? null);
  useEffect(() => {
    let cancelled = false;
    if (isFresh(cache, Date.now())) {
      setReadiness(cache!.value);
      return;
    }
    // Coalesce concurrent callers onto a single request; cache the resolved value.
    if (!inflight) {
      inflight = fetchReadiness().then((value) => {
        cache = { at: Date.now(), value };
        inflight = null;
        return value;
      });
    }
    void inflight.then((value) => {
      if (!cancelled) setReadiness(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return readiness;
}

/** Test-only: reset the module cache so tests don't leak state into each other. */
export function __resetReadinessCache(): void {
  cache = null;
  inflight = null;
}
