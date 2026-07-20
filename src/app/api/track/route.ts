import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/server';
import { log } from '@/lib/log';
import { readCappedText } from '@/lib/net/bounded';
import type { Json } from '@/lib/supabase/types';
import { isTrackEvent, type TrackBatch, type TrackRecord } from '@/lib/tracking/taxonomy';
import { findCocktailBySlug, menuCategoryOf } from '@/data/cocktail';
import { restaurantTypeFor, type RestaurantType } from '@/lib/segments';

export const runtime = 'nodejs';

const MAX_EVENTS = 50;
/** Reject oversized bodies before parsing — 50 events fit comfortably under this. */
const MAX_BODY_BYTES = 64_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-field caps for the free text this PUBLIC ingest persists. The body cap alone bounds
 * only the REQUEST — one 64KB body can still store a single 60KB `language`, and every
 * other write path in the app caps its stored strings (names 120, slugs 120, labels 80).
 * An over-long value is dropped to null rather than truncated: a truncated id would still
 * join against other rows and quietly corrupt sessionisation, whereas null cannot.
 */
const MAX_ID_LEN = 128;
const MAX_TRACK_SLUG_LEN = 120;
const MAX_SHORT_LEN = 32;
const MAX_REFERRER_LEN = 512;

const capped = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length <= max ? value : null;

/**
 * Tenant slugs are lowercase alphanumeric + hyphen, 1–64 chars. This PUBLIC, anonymous
 * endpoint takes its target tenant from the request body, so an attacker-shaped slug must be
 * rejected BEFORE it reaches the DB. Two-layer defense: (1) this static format allowlist, then
 * (2) resolveRestaurantId() below, which drops slugs that don't resolve to a real tenant.
 *
 * LONG-TERM FIX: the proper defense is to stop trusting a body-supplied slug at all and derive
 * the tenant server-side — from a signed QR/menu token or a session — so an anonymous client
 * cannot name which tenant it writes under. This allowlist + the resolve check are the
 * infra-free interim hardening until that lands.
 */
const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

// Cache restaurant slug → uuid (resolved once per server instance).
const restaurantIdCache = new Map<string, string>();

async function resolveRestaurantId(slug: string): Promise<string | null> {
  const cached = restaurantIdCache.get(slug);
  if (cached) return cached;
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  const id = data?.id ?? null;
  if (id) restaurantIdCache.set(slug, id);
  return id;
}

interface EventRow {
  restaurant_id: string;
  event_id: string | null;
  cocktail_slug: string | null;
  event_name: string;
  session_id: string;
  visitor_id: string | null;
  table_id: string | null;
  device_type: string | null;
  language: string | null;
  referrer: string | null;
  value_num: number | null;
  metadata: Json | null;
  occurred_at: string;
}

function toRow(restaurantId: string, restaurantType: RestaurantType, e: TrackRecord, now: number): EventRow | null {
  // An over-long session id makes the event unusable for sessionisation, so the whole
  // event is dropped rather than stored under a truncated or null session.
  const sessionId = capped(e.sessionId, MAX_ID_LEN);
  if (!isTrackEvent(e.event) || !sessionId) {
    return null;
  }
  // Trust the client clock but clamp obvious skew to the server's now.
  const occurred =
    typeof e.occurredAt === 'number' && Math.abs(now - e.occurredAt) <= DAY_MS
      ? e.occurredAt
      : now;
  // Stamp business segment on EVERY data point (server-derived, NOT client-trusted) so future
  // threshold-learning can normalise by business type + dish category. Backfilling is impossible.
  const clientMeta = e.metadata && typeof e.metadata === 'object' ? (e.metadata as Record<string, unknown>) : {};
  const menuCategory = menuCategoryOf(typeof e.cocktailSlug === 'string' ? findCocktailBySlug(e.cocktailSlug) : undefined);
  const metadata = {
    ...clientMeta,
    restaurantType,
    menuCategory,
    eventVersion: typeof e.eventVersion === 'number' ? e.eventVersion : 1,
    eventSource: typeof e.eventSource === 'string' ? e.eventSource : 'unknown',
  } as unknown as Json;
  return {
    restaurant_id: restaurantId,
    event_id: capped(e.eventId, MAX_ID_LEN),
    cocktail_slug: capped(e.cocktailSlug, MAX_TRACK_SLUG_LEN),
    event_name: e.event,
    session_id: sessionId,
    visitor_id: capped(e.visitorId, MAX_ID_LEN),
    table_id: capped(e.tableId, MAX_ID_LEN),
    device_type: capped(e.deviceType, MAX_SHORT_LEN),
    language: capped(e.language, MAX_SHORT_LEN),
    referrer: capped(e.referrer, MAX_REFERRER_LEN),
    value_num: typeof e.value === 'number' && Number.isFinite(e.value) ? e.value : null,
    metadata,
    occurred_at: new Date(occurred).toISOString(),
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  // Abuse guards for this PUBLIC, unauthenticated ingest (see follow-up: durable per-IP
  // rate limiting needs Vercel KV / Upstash — these are the infra-free first line):
  // (1) reject clear third-party abuse: a real diner request is same-origin; only an
  //     explicit cross-site fetch is refused (same-origin/same-site/none stay allowed,
  //     so fetch + sendBeacon from the menu are never blocked). Non-browser clients omit
  //     the header — the durable defense is the rate limiter above.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }
  // (2) enforce the payload cap WHILE READING — a chunked request omits Content-Length, so
  //     the header can't be trusted; refuse before parsing an unbounded body.
  const raw = await readCappedText(request.body, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ success: false, error: 'payload too large' }, { status: 413 });
  }

  let batch: TrackBatch;
  try {
    batch = JSON.parse(raw) as TrackBatch;
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 });
  }

  const slug = typeof batch?.restaurantSlug === 'string' ? batch.restaurantSlug : 'diner';
  // Reject a malformed tenant slug up front (see SLUG_PATTERN). A legit menu/QR client always
  // sends a well-formed slug, so valid tracking is unaffected; only attacker-shaped strings are
  // refused before they can be resolved or written under.
  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ success: false, error: 'invalid slug' }, { status: 400 });
  }
  const events = Array.isArray(batch?.events) ? batch.events.slice(0, MAX_EVENTS) : [];
  if (events.length === 0) {
    return NextResponse.json({ success: true, inserted: 0 });
  }

  try {
    const restaurantId = await resolveRestaurantId(slug);
    if (!restaurantId) {
      // Unknown tenant — accept silently so the client never retries/errors,
      // but log so a real drop (typo'd slug, bad deploy) is still visible.
      log.warn('track', 'unknown restaurant slug', { slug });
      return NextResponse.json({ success: true, inserted: 0 });
    }
    const restaurantType = restaurantTypeFor(slug);

    const now = Date.now();
    const rows = events
      .map((e) => toRow(restaurantId, restaurantType, e, now))
      .filter((row): row is EventRow => row !== null);

    if (rows.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const supabase = createAdminSupabase();
    // Idempotent ingest: INSERT ... ON CONFLICT (event_id) DO NOTHING, so a retried or
    // duplicated delivery never double-counts. Requires the unique index from migration
    // 0008; until that is applied we degrade gracefully to a plain insert so NO events are
    // lost meanwhile (the client retries; dedupe activates automatically once 0008 is live).
    // `event_id` isn't in the generated types until migration 0008 is applied — cast at this boundary.
    let { error } = await supabase
      .from('events')
      .upsert(rows as unknown as never[], { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) {
      // event_id column / unique index not present yet → drop event_id and insert plainly.
      const noId = rows.map(({ event_id: _omitId, ...rest }) => rest);
      ({ error } = await supabase.from('events').insert(noId));
      // Pre-0006 safety: the visitor_id column might also be missing.
      if (error && /visitor_id/.test(error.message)) {
        const noVis = noId.map(({ visitor_id: _omitVis, ...rest }) => rest);
        ({ error } = await supabase.from('events').insert(noVis));
      }
    }
    if (error) {
      // Ingest failure = data-pipeline incident: log the real cause server-side;
      // the client only needs a non-2xx to keep the batch persisted and retry.
      log.error('track', error.message, { slug, batch: rows.length });
      return NextResponse.json({ success: false, error: 'ingest failed' }, { status: 500 });
    }
    return NextResponse.json({ success: true, inserted: rows.length });
  } catch (error: unknown) {
    log.error('track', error instanceof Error ? error.message : 'unexpected error', {
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ success: false, error: 'ingest failed' }, { status: 500 });
  }
}
