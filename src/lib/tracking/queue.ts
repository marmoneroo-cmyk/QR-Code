/**
 * Reliable batching queue.
 *
 * Events are PERSISTED to localStorage on enqueue, so a crash / hard navigation /
 * failed send never loses them. They are removed ONLY after a confirmed 2xx, and
 * retried on the next flush, on regaining network, and on the next page load
 * (drain-on-load). On unload we best-effort `sendBeacon` but keep them persisted —
 * combined with the server-side idempotency key (`eventId`), delivery is
 * at-least-once with an exactly-once EFFECT. Failures are never swallowed into
 * silent data loss; failed events stay in the queue.
 */

import type { TrackBatch, TrackRecord } from './taxonomy';

const ENDPOINT = '/api/track';
const FLUSH_DELAY_MS = 4000;
const MAX_BATCH = 50; // matches the server's MAX_EVENTS
const MAX_PERSIST = 500; // cap localStorage growth — keep the NEWEST beyond this
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 60000;
const STORE_KEY = 'cocktail-demo:track-queue';

let pending: TrackRecord[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let sending = false;
let loaded = false;
let listenersBound = false;
let restaurantSlug = 'diner';

export function setRestaurantSlug(slug: string): void {
  if (slug) restaurantSlug = slug;
}

function loadPersisted(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) pending = parsed as TrackRecord[];
    }
  } catch {
    /* corrupt store — start clean rather than crash the page */
  }
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    if (pending.length > MAX_PERSIST) pending = pending.slice(pending.length - MAX_PERSIST);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(pending));
  } catch {
    /* storage full/blocked — at least keep it in memory for this session */
  }
}

async function attemptFlush(): Promise<void> {
  if (sending || typeof window === 'undefined') return;
  loadPersisted();
  if (pending.length === 0) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  sending = true;
  const batch = pending.slice(0, MAX_BATCH);
  const ids = new Set(batch.map((b) => b.eventId));
  let acked = false;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantSlug, events: batch } satisfies TrackBatch),
      keepalive: true,
    });
    acked = res.ok; // a non-2xx means KEEP & retry — never drop
  } catch {
    acked = false; // network failure — keep & retry
  } finally {
    sending = false;
    if (acked) {
      pending = pending.filter((p) => !ids.has(p.eventId)); // remove ONLY the confirmed
      persist();
      retryAttempt = 0;
      if (pending.length > 0) scheduleFlush(0); // drain the rest
    } else {
      scheduleRetry(); // backoff; events remain persisted
    }
  }
}

function scheduleFlush(delay: number = FLUSH_DELAY_MS): void {
  if (timer || typeof window === 'undefined') return;
  timer = setTimeout(() => {
    timer = null;
    void attemptFlush();
  }, delay);
}

function scheduleRetry(): void {
  if (retryTimer || typeof window === 'undefined') return;
  const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt, RETRY_MAX_MS);
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void attemptFlush();
  }, delay);
}

/**
 * Unload path: best-effort beacon. Events stay persisted — the next load retries and
 * the server de-dupes on `eventId`, so nothing is lost and nothing is double-counted.
 */
function flushBeacon(): void {
  loadPersisted();
  if (pending.length === 0 || typeof navigator === 'undefined') return;
  try {
    const batch = pending.slice(0, MAX_BATCH);
    const body = JSON.stringify({ restaurantSlug, events: batch } satisfies TrackBatch);
    if ('sendBeacon' in navigator) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
  } catch {
    /* keep persisted for the next load */
  }
}

function bindListeners(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBeacon();
  });
  window.addEventListener('pagehide', flushBeacon);
  window.addEventListener('online', () => {
    retryAttempt = 0;
    void attemptFlush();
  });
}

export function enqueue(record: TrackRecord): void {
  if (typeof window === 'undefined') return;
  loadPersisted();
  pending.push(record);
  persist();
  bindListeners();
  if (pending.length >= MAX_BATCH) {
    void attemptFlush();
    return;
  }
  scheduleFlush();
}

/** Public best-effort flush (kept for API compatibility). */
export function flush(): void {
  void attemptFlush();
}
