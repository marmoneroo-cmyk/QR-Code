/**
 * track() — the single entry point for diner-facing analytics.
 * Enriches a payload with anonymous session/context and enqueues it for batched
 * delivery. No-ops on the server and when the visitor has opted out. Never throws.
 */

import type { TrackPayload, TrackRecord } from './taxonomy';
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

export function track(payload: TrackPayload): void {
  if (typeof window === 'undefined') return;
  if (isOptedOut()) return;

  try {
    const record: TrackRecord = {
      ...payload,
      // Stamp source/origin (attribution) + a transitional copy of visitorId so
      // visitor metrics are verifiable before migration 0006 and so 0006's
      // backfill (metadata->>'visitorId' → column) has data.
      metadata: { ...(payload.metadata ?? {}), source: getSource(), origin: getOrigin(), visitorId: getVisitorId() },
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      tableId: getTableId(),
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
