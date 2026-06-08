/**
 * Anonymous identity + context for analytics. No PII, no fingerprinting.
 *  · sessionId — per browser session (sessionStorage), resets when the tab closes.
 *  · visitorId — opaque, longer-lived (localStorage), powers "returning visitor".
 *  · tableId   — from the QR `?t=` param, persisted for the session.
 * Everything is guarded for SSR (returns safe defaults on the server).
 */

import type { DeviceType } from './taxonomy';

const SESSION_KEY = 'cocktail-demo:session-id';
const VISITOR_KEY = 'cocktail-demo:visitor-id';
const TABLE_KEY = 'cocktail-demo:table-id';
const OPTOUT_KEY = 'cocktail-demo:no-track';
const IMPRESSED_KEY = 'cocktail-demo:impressed';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function uuid(): string {
  if (isBrowser() && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (older browsers) — not cryptographically strong, fine for an id.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readOrCreate(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const fresh = uuid();
  storage.setItem(key, fresh);
  return fresh;
}

const SESSION_TS_KEY = 'cocktail-demo:session-ts';
// RESTAURANT session model, not a web-analytics one: a guest sits for a while
// and may order across a 2-hour meal. A 30-min web window would split one guest
// (19:00 scan → 20:00 second order) into two "guests". 2h keeps a sitting as one
// visit. (A true "until table closes" signal would need POS integration.)
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * A "session" = one dining visit: activity within a 2-hour sliding window.
 * Stored in localStorage (survives tab close/reopen, shared across tabs), so
 * reopening or a second tab does NOT mint a new session.
 */
export function getSessionId(): string {
  if (!isBrowser()) return 'ssr';
  try {
    const ls = window.localStorage;
    const now = Date.now();
    const lastTs = Number(ls.getItem(SESSION_TS_KEY) || '0');
    let id = ls.getItem(SESSION_KEY);
    if (!id || !lastTs || now - lastTs > SESSION_TTL_MS) {
      id = uuid();
      ls.setItem(SESSION_KEY, id);
    }
    ls.setItem(SESSION_TS_KEY, String(now));
    return id;
  } catch {
    return 'ssr';
  }
}

export function getVisitorId(): string {
  if (!isBrowser()) return 'ssr';
  try {
    return readOrCreate(window.localStorage, VISITOR_KEY);
  } catch {
    return 'ssr';
  }
}

/**
 * Resolve the table id: prefer a `?t=` query param (and persist it for the
 * session), else fall back to the previously stored value.
 */
export function getTableId(): string | null {
  if (!isBrowser()) return null;
  try {
    const param = new URLSearchParams(window.location.search).get('t');
    if (param) {
      window.sessionStorage.setItem(TABLE_KEY, param);
      return param;
    }
    return window.sessionStorage.getItem(TABLE_KEY);
  } catch {
    return null;
  }
}

export function getDeviceType(): DeviceType {
  if (!isBrowser()) return 'desktop';
  const w = window.innerWidth;
  if (w <= 640) return 'mobile';
  if (w <= 1024) return 'tablet';
  return 'desktop';
}

export function getReferrer(): string | null {
  if (!isBrowser()) return null;
  return document.referrer || null;
}

/**
 * Record a cocktail impression once per browser session. Returns true the FIRST
 * time a slug is seen this session (so the caller should fire the event), false
 * afterwards — survives menu remounts / back-navigation, preventing inflated
 * "seen" counts where every drink looks viewed.
 */
export function markImpressedOnce(slug: string): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = window.sessionStorage.getItem(IMPRESSED_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(slug)) return false;
    seen.push(slug);
    window.sessionStorage.setItem(IMPRESSED_KEY, JSON.stringify(seen));
    return true;
  } catch {
    return true;
  }
}

const SOURCE_KEY = 'cocktail-demo:source';
const ORIGIN_KEY = 'cocktail-demo:origin';

/**
 * ORIGIN = how the LINK was created (declared via `?src=`), independent of how
 * this particular visitor arrived. A table QR is built as `?t=8&src=table_qr`,
 * so every link derived from it carries origin=table_qr — including shares.
 */
export function getOrigin(): string {
  if (!isBrowser()) return 'direct';
  try {
    const existing = window.sessionStorage.getItem(ORIGIN_KEY);
    if (existing) return existing;
    const params = new URLSearchParams(window.location.search);
    const srcParam = params.get('src');
    const hasTable = Boolean(params.get('t'));
    const origin = srcParam ?? (hasTable ? 'table_qr' : 'direct');
    window.sessionStorage.setItem(ORIGIN_KEY, origin);
    return origin;
  } catch {
    return 'direct';
  }
}

/**
 * SOURCE = how THIS visitor actually arrived (referrer-first). Critically, a
 * table-QR link shared to WhatsApp resolves to source=whatsapp (NOT table_qr),
 * even though origin stays table_qr. This is what lets Table Performance count
 * only real scans (source=table_qr) and Share/Viral count the rest.
 */
export function getSource(): string {
  if (!isBrowser()) return 'direct';
  try {
    const existing = window.sessionStorage.getItem(SOURCE_KEY);
    if (existing) return existing;

    const ref = (document.referrer || '').toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const hasTable = Boolean(params.get('t'));

    let src: string;
    if (/instagram/.test(ref)) src = 'instagram';
    else if (/whatsapp|wa\.me/.test(ref)) src = 'whatsapp';
    else if (/facebook|fb\.com|fb\.me/.test(ref)) src = 'facebook';
    else if (/tiktok/.test(ref)) src = 'tiktok';
    else if (/t\.co|twitter|x\.com/.test(ref)) src = 'twitter';
    else if (/google|bing|duckduckgo/.test(ref)) src = 'search';
    else if (ref) src = 'referral';
    else if (hasTable) src = 'table_qr'; // no referrer + ?t= = a genuine scan at the table
    else src = 'direct';

    window.sessionStorage.setItem(SOURCE_KEY, src);
    return src;
  } catch {
    return 'direct';
  }
}

/** Respect an explicit opt-out (localStorage flag) or browser Do-Not-Track. */
export function isOptedOut(): boolean {
  if (!isBrowser()) return true;
  try {
    if (window.localStorage.getItem(OPTOUT_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  const dnt =
    navigator.doNotTrack === '1' ||
    (window as unknown as { doNotTrack?: string }).doNotTrack === '1';
  return Boolean(dnt);
}
