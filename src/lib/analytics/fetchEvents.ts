import 'server-only';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/** PostgREST caps a single response at `max-rows` (1000 by default). */
const PAGE = 1000;
/**
 * Safety ceiling so a runaway restaurant can't pull unbounded rows into memory.
 * At this scale the aggregation should move server-side (SQL/RPC); until then
 * this bounds the read and we accept reading the most-recent HARD_CAP events.
 */
const DEFAULT_HARD_CAP = 100_000;

/**
 * Read ALL matching events for a restaurant, paginating past PostgREST's 1000-row
 * `max-rows` cap.
 *
 * The bug this fixes: `.from('events').…​.limit(50000)` is SILENTLY capped at 1000
 * by the server, so every analytics function computed on only the 1000 most-recent
 * events. Any restaurant past 1000 events (the demo already has ~2000) had older
 * events — including whole event types like order_completed — invisible to demand,
 * funnel, experiments, and signals. This loops `.range()` until the source is drained.
 *
 * Ordered newest-first so a hardCap truncation drops the OLDEST events, not the newest.
 */
export async function fetchAllEvents<T = Record<string, unknown>>(
  sb: SupabaseServerClient,
  restaurantId: string,
  select: string,
  opts: { eventNames?: readonly string[]; hardCap?: number } = {},
): Promise<T[]> {
  const hardCap = opts.hardCap ?? DEFAULT_HARD_CAP;
  const out: T[] = [];

  for (let from = 0; from < hardCap; from += PAGE) {
    let query = sb.from('events').select(select).eq('restaurant_id', restaurantId);
    if (opts.eventNames && opts.eventNames.length > 0) {
      query = query.in('event_name', opts.eventNames as string[]);
    }
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);

    const batch = (data ?? []) as T[];
    out.push(...batch);
    // A short page means the source is exhausted — stop before an empty round-trip.
    if (batch.length < PAGE) break;
  }

  return out;
}
