import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { MENU } from '@/data/cocktail';
import type { JourneyStep, SessionJourney, SessionJourneys } from './journey-types';

const TENANT_SLUG = 'diner';
const SCAN_LIMIT = 6000; // recent events to scan for journeys

const priceBySlug = new Map<string, number>(MENU.map((c) => [c.slug, c.priceILS ?? 0]));

interface Row {
  event_name: string | null;
  cocktail_slug: string | null;
  session_id: string | null;
  table_id: string | null;
  device_type: string | null;
  language: string | null;
  value_num: number | null;
  metadata: unknown;
  occurred_at: string | null;
  created_at: string;
}

interface OrderMeta {
  revenue?: number; profit?: number; priceAtOrder?: number; costAtOrder?: number;
  revenueILS?: number; unitPriceILS?: number;
}

function orderRevenue(r: Row): number {
  const meta = (r.metadata ?? {}) as OrderMeta;
  const captured = meta.revenue ?? meta.revenueILS;
  if (typeof captured === 'number') return captured;
  const qty = typeof r.value_num === 'number' ? r.value_num : 1;
  const unit = meta.priceAtOrder ?? meta.unitPriceILS ?? priceBySlug.get(r.cocktail_slug ?? '') ?? 0;
  return qty * unit;
}

function orderProfit(r: Row): number {
  const meta = (r.metadata ?? {}) as OrderMeta;
  if (typeof meta.profit === 'number') return meta.profit;
  const qty = typeof r.value_num === 'number' ? r.value_num : 1;
  const cost = typeof meta.costAtOrder === 'number' ? meta.costAtOrder : 0;
  return orderRevenue(r) - qty * cost;
}

function sourceOf(r: Row): string | null {
  const meta = (r.metadata ?? {}) as { source?: string };
  return meta.source ?? null;
}

function originOf(r: Row): string | null {
  const meta = (r.metadata ?? {}) as { origin?: string };
  return meta.origin ?? null;
}

/**
 * Reconstruct per-session journeys ("replay lite"): the ordered timeline of
 * every action a visitor took, grouped by session. Returns the most recent
 * sessions first. No PII — sessions are opaque ids.
 */
export async function getSessionJourneys(limit = 40, restaurantSlug: string = TENANT_SLUG): Promise<SessionJourneys> {
  try {
    const supabase = createAdminSupabase();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return { sessions: [], hasData: false };

    const { data } = await supabase
      .from('events')
      .select('event_name, cocktail_slug, session_id, table_id, device_type, language, value_num, metadata, occurred_at, created_at')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(SCAN_LIMIT);
    if (!data || data.length === 0) return { sessions: [], hasData: false };

    const rows = data as Row[];
    const bySession = new Map<string, Row[]>();
    for (const r of rows) {
      if (!r.session_id) continue;
      const list = bySession.get(r.session_id);
      if (list) list.push(r);
      else bySession.set(r.session_id, [r]);
    }

    const sessions: SessionJourney[] = [];
    for (const [sessionId, list] of bySession) {
      // Ascending chronological order within the session.
      const sorted = [...list].sort(
        (a, b) =>
          new Date(a.occurred_at ?? a.created_at).getTime() -
          new Date(b.occurred_at ?? b.created_at).getTime(),
      );
      const steps: JourneyStep[] = sorted.map((r) => ({
        event: r.event_name ?? 'unknown',
        cocktailSlug: r.cocktail_slug,
        at: r.occurred_at ?? r.created_at,
        value: r.value_num,
      }));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const orders = sorted.filter((r) => r.event_name === 'order_completed');
      const start = first.occurred_at ?? first.created_at;
      const end = last.occurred_at ?? last.created_at;
      sessions.push({
        sessionId,
        start,
        end,
        durationMs: Math.max(0, new Date(end).getTime() - new Date(start).getTime()),
        tableId: sorted.find((r) => r.table_id)?.table_id ?? null,
        source: sorted.map(sourceOf).find((s) => s) ?? null,
        origin: sorted.map(originOf).find((s) => s) ?? null,
        device: first.device_type,
        language: first.language,
        steps,
        views: sorted.filter((r) => r.event_name === 'cocktail_opened').length,
        ingredients: sorted.filter((r) => r.event_name === 'ingredients_opened').length,
        shares: sorted.filter((r) => r.event_name === 'cocktail_shared' || r.event_name === 'menu_shared').length,
        orders: orders.length,
        units: orders.reduce((s, r) => s + (typeof r.value_num === 'number' ? r.value_num : 1), 0),
        ordered: orders.length > 0,
        revenue: Math.round(orders.reduce((s, r) => s + orderRevenue(r), 0)),
        profit: Math.round(orders.reduce((s, r) => s + orderProfit(r), 0)),
      });
    }

    sessions.sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime());
    return { sessions: sessions.slice(0, limit), hasData: true };
  } catch {
    return { sessions: [], hasData: false };
  }
}
