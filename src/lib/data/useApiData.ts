'use client';

import { useCallback } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';

/** The app's standard JSON envelope for every /api read route. */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Shared fetcher for admin data surfaces: fetches a URL (no-store, like the hand-rolled loads
 * it replaces), unwraps the `{ success, data }` envelope, and throws on a non-ok status or an
 * unsuccessful envelope so SWR routes it to `error` (keeping the last good `data`).
 */
export async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!json.success || json.data === undefined) {
    throw new Error(json.error ?? 'Request unsuccessful');
  }
  return json.data;
}

export interface UseApiData<T> {
  /** Last successful payload, or null before the first load (kept across a failed refresh). */
  data: T | null;
  /** True only during the first load (no data yet) — matches the old useState(true) spinner. */
  loading: boolean;
  /** Set when the latest fetch failed; `data` retains the last good value. */
  error: Error | null;
  /** Imperatively revalidate (replaces manual `load()` calls behind refresh buttons). */
  reload: () => void;
}

/**
 * Envelope-aware wrapper over SWR — the single data-fetching primitive for the admin surfaces,
 * replacing the fetch + loading + error + poll + visibility-refresh effect that was hand-rolled
 * (and duplicated) across ~19 pages. Built on SWR (useSyncExternalStore under the hood), so it
 * carries no set-state-in-effect and adds request dedup, caching, and focus/reconnect
 * revalidation for free.
 *
 * @param key  the API URL to fetch, or `null` to skip fetching (conditional/dependent loads).
 * @param options  SWR passthrough — e.g. `{ refreshInterval }` for the pages that polled.
 */
export function useApiData<T>(key: string | null, options?: SWRConfiguration<T>): UseApiData<T> {
  const { data, error, isLoading, mutate } = useSWR<T>(key, apiFetcher, options);
  // mutate is stable per key, so reload is stable — consumers can safely list it in deps.
  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);
  return {
    data: data ?? null,
    loading: isLoading,
    error: (error as Error | undefined) ?? null,
    reload,
  };
}
