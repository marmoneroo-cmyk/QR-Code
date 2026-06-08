import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import { isTrackEvent, type TrackBatch, type TrackRecord } from '@/lib/tracking/taxonomy';

export const runtime = 'nodejs';

const MAX_EVENTS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function toRow(restaurantId: string, e: TrackRecord, now: number): EventRow | null {
  if (!isTrackEvent(e.event) || typeof e.sessionId !== 'string' || !e.sessionId) {
    return null;
  }
  // Trust the client clock but clamp obvious skew to the server's now.
  const occurred =
    typeof e.occurredAt === 'number' && Math.abs(now - e.occurredAt) <= DAY_MS
      ? e.occurredAt
      : now;
  return {
    restaurant_id: restaurantId,
    cocktail_slug: typeof e.cocktailSlug === 'string' ? e.cocktailSlug : null,
    event_name: e.event,
    session_id: e.sessionId,
    visitor_id: typeof e.visitorId === 'string' ? e.visitorId : null,
    table_id: typeof e.tableId === 'string' ? e.tableId : null,
    device_type: typeof e.deviceType === 'string' ? e.deviceType : null,
    language: typeof e.language === 'string' ? e.language : null,
    referrer: typeof e.referrer === 'string' ? e.referrer : null,
    value_num: typeof e.value === 'number' && Number.isFinite(e.value) ? e.value : null,
    metadata: e.metadata && typeof e.metadata === 'object' ? (e.metadata as Json) : null,
    occurred_at: new Date(occurred).toISOString(),
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let batch: TrackBatch;
  try {
    batch = (await request.json()) as TrackBatch;
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 });
  }

  const slug = typeof batch?.restaurantSlug === 'string' ? batch.restaurantSlug : 'diner';
  const events = Array.isArray(batch?.events) ? batch.events.slice(0, MAX_EVENTS) : [];
  if (events.length === 0) {
    return NextResponse.json({ success: true, inserted: 0 });
  }

  try {
    const restaurantId = await resolveRestaurantId(slug);
    if (!restaurantId) {
      // Unknown tenant — accept silently so the client never retries/errors.
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const now = Date.now();
    const rows = events
      .map((e) => toRow(restaurantId, e, now))
      .filter((row): row is EventRow => row !== null);

    if (rows.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const supabase = createAdminSupabase();
    let { error } = await supabase.from('events').insert(rows);

    // Forward/backward compatible: if migration 0006 (visitor_id) hasn't been
    // applied yet, the column is unknown — strip it and retry so NO events are
    // lost in the window before the migration runs.
    if (error && /visitor_id/.test(error.message)) {
      const stripped = rows.map(({ visitor_id: _omit, ...rest }) => rest);
      ({ error } = await supabase.from('events').insert(stripped));
    }
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, inserted: rows.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
