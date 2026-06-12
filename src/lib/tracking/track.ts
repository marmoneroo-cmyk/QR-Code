/**
 * track() — the single entry point for diner-facing analytics.
 * Enriches a payload with anonymous session/context and enqueues it for batched
 * delivery. No-ops on the server and when the visitor has opted out. Never throws.
 */

import { EVENT_VERSION, type EventSource, type TrackPayload, type TrackRecord } from './taxonomy';
import {
  getDeviceType,
  getOrigin,
  getReferrer,
  getSessionId,
  getSource,
  getTableId,
  getVisitorId,
  isOptedOut,
} from './session';
import { enqueue } from './queue';

const LANG_KEY = 'cocktail-demo:lang';

function getLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  try {
    return window.localStorage.getItem(LANG_KEY) || 'en';
  } catch {
    return 'en';
  }
}

/** Idempotency key — a UUID per event so a retry/dup delivery de-dupes server-side. */
function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Where the event was produced — derived from the route + table context. */
function deriveSource(tableId: string | null): EventSource {
  if (typeof window === 'undefined') return 'unknown';
  const path = window.location.pathname;
  if (path.startsWith('/ar/')) return 'ar_mode';
  if (path.startsWith('/kiosk')) return 'tablet_kiosk';
  if (tableId) return 'qr_table';
  return 'mobile_menu';
}

export function track(payload: TrackPayload): void {
  if (typeof window === 'undefined') return;
  if (isOptedOut()) return;

  try {
    const tableId = getTableId();
    const record: TrackRecord = {
      ...payload,
      eventId: newEventId(),
      eventVersion: EVENT_VERSION,
      eventSource: deriveSource(tableId),
      // Stamp source/origin (attribution) + a transitional copy of visitorId so
      // visitor metrics are verifiable before migration 0006 and so 0006's
      // backfill (metadata->>'visitorId' → column) has data.
      metadata: { ...(payload.metadata ?? {}), source: getSource(), origin: getOrigin(), visitorId: getVisitorId() },
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      tableId,
      deviceType: getDeviceType(),
      language: getLanguage(),
      referrer: getReferrer(),
      occurredAt: Date.now(),
    };
    enqueue(record);
  } catch {
    /* analytics must never break the app */
  }
}
