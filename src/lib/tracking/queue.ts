/**
 * Tiny batching queue. Events accumulate in memory and flush to /api/track:
 *  · on a short timer (so a quick session still reports), and
 *  · on visibilitychange/pagehide (so the last events survive a tab close).
 * Uses navigator.sendBeacon (survives unload) with a fetch+keepalive fallback.
 */

import type { TrackBatch, TrackRecord } from './taxonomy';

const ENDPOINT = '/api/track';
const FLUSH_DELAY_MS = 4000;
const MAX_BUFFER = 30;

let buffer: TrackRecord[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;
let restaurantSlug = 'diner';

export function setRestaurantSlug(slug: string): void {
  if (slug) restaurantSlug = slug;
}

function send(batch: TrackBatch): void {
  const body = JSON.stringify(batch);
  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }
  } catch {
    /* fall through to fetch */
  }
  // Fallback — keepalive lets it finish during unload.
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* analytics must never throw into the app */
  });
}

export function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  send({ restaurantSlug, events });
}

function bindUnloadListeners(): void {
  if (listenersBound || typeof document === 'undefined') return;
  listenersBound = true;
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
}

export function enqueue(record: TrackRecord): void {
  buffer.push(record);
  bindUnloadListeners();
  if (buffer.length >= MAX_BUFFER) {
    flush();
    return;
  }
  if (!timer) {
    timer = setTimeout(flush, FLUSH_DELAY_MS);
  }
}
