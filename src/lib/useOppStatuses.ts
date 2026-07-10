'use client';

import { useCallback } from 'react';
import { useLocalStorageState } from './useLocalStorageState';
import type { OppStatusKind, OppStatusEntry, OppStatusMap } from '@/lib/value/focus';

/** localStorage key shared by the Action Center and the Opportunity board so they stay in sync. */
const KEY = 'cocktail-demo:opps';
const SNOOZE_MS = 24 * 60 * 60 * 1000; // "remind me tomorrow" = now + 24h
const EMPTY: OppStatusMap = {};

function parse(raw: string | null): OppStatusMap {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    return parsed as OppStatusMap;
  } catch {
    return EMPTY;
  }
}

const serialize = (map: OppStatusMap): string => JSON.stringify(map);

export interface OppStatusesApi {
  statuses: OppStatusMap;
  /** Set an explicit status; `snoozed` carries a 24h `until`. */
  setStatus: (id: string, status: OppStatusKind) => void;
  /** Convenience for `setStatus(id, 'done')`. */
  markDone: (id: string) => void;
  /** Remove a status entry (undo). */
  clearStatus: (id: string) => void;
}

/**
 * Per-opportunity status (done / dismissed / snoozed), persisted to localStorage and shared by
 * the Action Center and the Opportunity board — extracted from the two identical inline copies
 * those screens used to carry. Built on the shared SSR-safe localStorage store, so it hydrates
 * without a set-state-in-effect and stays in lock-step across tabs (and both screens) via that
 * store's storage/custom events.
 */
export function useOppStatuses(): OppStatusesApi {
  const { value: statuses, set } = useLocalStorageState<OppStatusMap>(KEY, parse, serialize, EMPTY);

  const setStatus = useCallback(
    (id: string, status: OppStatusKind) => {
      const entry: OppStatusEntry =
        status === 'snoozed' ? { status, until: Date.now() + SNOOZE_MS } : { status };
      set({ ...statuses, [id]: entry });
    },
    [set, statuses],
  );

  const markDone = useCallback((id: string) => setStatus(id, 'done'), [setStatus]);

  const clearStatus = useCallback(
    (id: string) => {
      if (!(id in statuses)) return;
      const next: OppStatusMap = { ...statuses };
      delete next[id];
      set(next);
    },
    [set, statuses],
  );

  return { statuses, setStatus, markDone, clearStatus };
}
