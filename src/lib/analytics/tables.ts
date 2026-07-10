import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { log } from '@/lib/log';
import { MENU } from '@/data/cocktail';
import type { TableIntelligence, TableRow } from './tables-types';

const TENANT_SLUG = 'diner';
const EVENT_LIMIT = 50000;

interface EventRow {
  event_name: string | null;
  table_id: string | null;
  session_id: string | null;
  cocktail_slug: string | null;
  value_num: number | null;
  metadata: unknown;
}

function metaOf(e: EventRow): { source?: string; origin?: string } {
  return (e.metadata ?? {}) as { source?: string; origin?: string };
}

/** Per-table accumulator (distinct sessions per signal + revenue). */
interface TableAccumulator {
  sessions: Set<string>;
  viewSessions: Set<string>;
  orderSessions: Set<string>;
  callWaiterSessions: Set<string>;
  units: number;
  revenue: number;
}

const EMPTY: TableIntelligence = {
  tables: [],
  totalRevenue: 0,
  viral: { sessions: 0, orders: 0, units: 0, revenue: 0 },
  hasData: false,
};

const priceBySlug = new Map<string, number>(MENU.map((c) => [c.slug, c.priceILS ?? 0]));

/** Revenue for one order_completed event: trust the revenue/price captured at
 *  order time, else fall back to current menu price × qty. */
function revenueForOrder(e: EventRow): number {
  const meta = (e.metadata ?? {}) as {
    revenue?: number; priceAtOrder?: number; revenueILS?: number; unitPriceILS?: number;
  };
  const captured = meta.revenue ?? meta.revenueILS;
  if (typeof captured === 'number') return captured;
  const qty = typeof e.value_num === 'number' ? e.value_num : 1;
  const unit = meta.priceAtOrder ?? meta.unitPriceILS ?? priceBySlug.get(e.cocktail_slug ?? '') ?? 0;
  return qty * unit;
}

/**
 * Per-table attribution from `events`. Everything is DISTINCT SESSIONS (Unique
 * Visits), with conversion = orders/views and revenue from order events.
 * A table only collects data once its QR carries `?t=<table>` (see the Tables
 * page's QR generator).
 */
export async function getTableIntelligence(
  restaurantSlug: string = TENANT_SLUG,
): Promise<TableIntelligence> {
  try {
    const supabase = createAdminSupabase();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return EMPTY;

    const { data, error } = await supabase
      .from('events')
      .select('event_name, table_id, session_id, cocktail_slug, value_num, metadata')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(EVENT_LIMIT);
    if (error || !data) return EMPTY;

    const events = data as EventRow[];
    const byTable = new Map<string, TableAccumulator>();
    const viralSessions = new Set<string>();
    let viralUnits = 0;
    let viralRevenue = 0;
    const viralOrderSessions = new Set<string>();
    let hasData = false;

    for (const event of events) {
      const tableId = event.table_id?.trim();
      if (!tableId) continue;
      hasData = true;

      const { source, origin } = metaOf(event);

      // Shared table-QR links (origin=table_qr but arrived via another channel)
      // are bucketed as VIRAL — never credited to the physical table.
      if (origin === 'table_qr' && source && source !== 'table_qr') {
        if (event.session_id) viralSessions.add(event.session_id);
        if (event.event_name === 'order_completed') {
          if (event.session_id) viralOrderSessions.add(event.session_id);
          viralUnits += typeof event.value_num === 'number' ? event.value_num : 1;
          viralRevenue += revenueForOrder(event);
        }
        continue;
      }

      // Table Performance: count ONLY genuine scans at the table.
      if (source !== 'table_qr') continue;

      let acc = byTable.get(tableId);
      if (!acc) {
        acc = {
          sessions: new Set(),
          viewSessions: new Set(),
          orderSessions: new Set(),
          callWaiterSessions: new Set(),
          units: 0,
          revenue: 0,
        };
        byTable.set(tableId, acc);
      }

      const sid = event.session_id ?? undefined;
      if (sid) acc.sessions.add(sid);

      switch (event.event_name) {
        case 'cocktail_opened':
          if (sid) acc.viewSessions.add(sid);
          break;
        case 'order_completed':
          if (sid) acc.orderSessions.add(sid);
          acc.units += typeof event.value_num === 'number' ? event.value_num : 1;
          acc.revenue += revenueForOrder(event);
          break;
        case 'call_waiter_clicked':
          if (sid) acc.callWaiterSessions.add(sid);
          break;
        default:
          break;
      }
    }

    let totalRevenue = 0;
    const tables: TableRow[] = Array.from(byTable.entries())
      .map(([tableId, acc]) => {
        const views = acc.viewSessions.size;
        const orders = acc.orderSessions.size;
        totalRevenue += acc.revenue;
        return {
          tableId,
          sessions: acc.sessions.size,
          views,
          orders,
          units: acc.units,
          conversionPct: views > 0 ? (orders / views) * 100 : 0,
          revenue: Math.round(acc.revenue),
          callWaiter: acc.callWaiterSessions.size,
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.views - a.views);

    return {
      tables,
      totalRevenue: Math.round(totalRevenue),
      viral: {
        sessions: viralSessions.size,
        orders: viralOrderSessions.size,
        units: viralUnits,
        revenue: Math.round(viralRevenue),
      },
      hasData,
    };
  } catch (e) {
    log.error('analytics', 'getTableIntelligence failed', {
      scope: 'getTableIntelligence',
      error: e instanceof Error ? e.message : String(e),
    });
    return EMPTY;
  }
}
