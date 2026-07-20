import 'server-only';
import { median } from '../math';
import { fetchAllEvents } from './fetchEvents';
import { readClient } from '@/lib/supabase/readClient';
import { log } from '@/lib/log';
import { TRACK_EVENTS } from '@/lib/tracking/taxonomy';
import { MENU, getEconomics } from '@/data/cocktail';
import type {
  AnalyticsOverview,
  IntegrityReport,
  MenuClass,
  MenuEngineering,
  MenuEngineeringItem,
  RawEvent,
  RawEventsResult,
  TopItem,
} from './types';

/** One cocktail's conversion funnel (distinct sessions per stage) + order units. */
export interface FunnelRow {
  cocktailSlug: string;
  seen: number;
  opened: number;
  ingredients: number;
  breakdown: number;
  called: number;
  /** Distinct sessions that completed an order (funnel conversion). */
  ordered: number;
  /** Total drinks ordered (sum of order_completed quantities). */
  units: number;
  /** Conversion-leak classification (vs. interest + the menu average). */
  flag: 'leak' | 'high_converter' | null;
}

const TENANT_SLUG = 'diner';
const LEAK_SAMPLE_MIN = 4; // need a few unique viewers before flagging

/**
 * Read the conversion funnel per cocktail from the `cocktail_funnel` view.
 * Server-only (uses the service-role client). Returns [] if Supabase isn't
 * configured or the tenant/view is missing — analytics never breaks the page.
 */
export async function getCocktailFunnels(restaurantSlug: string = TENANT_SLUG): Promise<FunnelRow[]> {
  try {
    const supabase = await readClient();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return [];

    const { data, error } = await supabase
      .from('cocktail_funnel')
      .select('*')
      .eq('restaurant_id', restaurant.id);
    if (error || !data) return [];

    // Total ordered UNITS per cocktail = sum of order_completed quantities.
    // (The funnel's `ordered` counts distinct sessions; this counts drinks.)
    const unitsBySlug = new Map<string, number>();
    // Paginated past PostgREST's 1000-row cap. A plain .limit(50000) did NOT raise
    // the ceiling — the server still returned only the 1000 newest order events —
    // so unit totals silently undercounted. The real scale fix is a SQL
    // `sum(value_num) filter (...)` in the cocktail_funnel view; this is complete meanwhile.
    const orders = await fetchAllEvents<{ cocktail_slug: string | null; value_num: number | null }>(
      supabase,
      restaurant.id,
      'cocktail_slug, value_num',
      { eventNames: ['order_completed'] },
    );
    for (const order of orders) {
      if (!order.cocktail_slug) continue;
      const qty = typeof order.value_num === 'number' ? order.value_num : 1;
      unitsBySlug.set(order.cocktail_slug, (unitsBySlug.get(order.cocktail_slug) ?? 0) + qty);
    }

    const base = data
      .filter((row) => row.cocktail_slug)
      .map((row) => ({
        cocktailSlug: row.cocktail_slug ?? 'unknown',
        seen: row.seen ?? 0,
        opened: row.opened ?? 0,
        ingredients: row.ingredients ?? 0,
        breakdown: row.breakdown ?? 0,
        called: row.called ?? 0,
        ordered: row.ordered ?? 0,
        units: unitsBySlug.get(row.cocktail_slug ?? '') ?? 0,
      }));

    // Menu-average conversion (entry = max(seen, opened)) over items with enough
    // sample — the baseline a leak/high-converter is measured against.
    const entryOf = (r: (typeof base)[number]) => Math.max(r.seen, r.opened);
    const sampled = base.filter((r) => entryOf(r) >= LEAK_SAMPLE_MIN);
    const avgConv =
      sampled.length > 0
        ? sampled.reduce((s, r) => s + r.ordered / Math.max(1, entryOf(r)), 0) / sampled.length
        : 0;

    const flagOf = (r: (typeof base)[number]): 'leak' | 'high_converter' | null => {
      const entry = entryOf(r);
      if (entry < LEAK_SAMPLE_MIN) return null;
      const conv = r.ordered / entry;
      const interest = r.opened > 0 ? r.ingredients / r.opened : 0;
      // Lots of interest but almost nobody orders → the offer is leaking.
      if (interest >= 0.4 && conv < Math.max(0.05, avgConv * 0.35)) return 'leak';
      // Converts far above the menu norm → protect & feature it.
      if (conv >= Math.max(0.25, avgConv * 1.6)) return 'high_converter';
      return null;
    };

    return base
      .map((r) => ({ ...r, flag: flagOf(r) }))
      .sort((a, b) => b.seen - a.seen);
  } catch (e) {
    log.error('analytics', 'getCocktailFunnels failed', {
      scope: 'getCocktailFunnels',
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

function emptyOverview(): AnalyticsOverview {
  return {
    totalViews: 0,
    totalOrders: 0,
    totalUnits: 0,
    conversionPct: 0,
    totalRevenue: 0,
    totalProfit: 0,
    topItemSlug: null,
    viewsByDay: new Array(WINDOW_DAYS).fill(0),
    ordersByDay: new Array(WINDOW_DAYS).fill(0),
    hourHeatmap: new Array(24).fill(0),
    topItems: [],
    hasData: false,
  };
}

/**
 * Real KPI overview. All counts are UNIQUE VISITS (distinct session_id):
 * "views" = sessions that opened a drink, "orders" = sessions that completed an
 * order, "units" = Σ quantity. Hour buckets use the server clock (UTC).
 */
export async function getAnalyticsOverview(
  restaurantSlug: string = TENANT_SLUG,
): Promise<AnalyticsOverview> {
  try {
    const supabase = await readClient();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return emptyOverview();

    // Paginated: was capped at 1000 by PostgREST, undercounting every rollup below.
    const data = await fetchAllEvents<{
      event_name: string;
      cocktail_slug: string | null;
      value_num: number | null;
      metadata: Record<string, unknown> | null;
      session_id: string | null;
      occurred_at: string | null;
      created_at: string | null;
    }>(
      supabase,
      restaurant.id,
      'event_name, cocktail_slug, value_num, metadata, session_id, occurred_at, created_at',
    );
    if (data.length === 0) return emptyOverview();

    // Price/cost per slug (price captured on the order event wins for revenue).
    const econBySlug = new Map(MENU.map((c) => [c.slug, getEconomics(c)]));

    const now = Date.now();
    // Everything is measured as UNIQUE VISITS (distinct session_id), so F5
    // refreshes and repeat opens in one visit never inflate the numbers.
    const viewSessions = new Set<string>();
    const orderSessions = new Set<string>();
    let totalUnits = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    const viewsByDaySets = Array.from({ length: WINDOW_DAYS }, () => new Set<string>());
    const ordersByDaySets = Array.from({ length: WINDOW_DAYS }, () => new Set<string>());
    const hourSets = Array.from({ length: 24 }, () => new Set<string>());
    const itemViewSessions = new Map<string, Set<string>>();
    const itemOrderSessions = new Map<string, Set<string>>();
    const itemUnits = new Map<string, number>();
    const itemRevenue = new Map<string, number>();

    const addTo = (map: Map<string, Set<string>>, slug: string, sid: string) => {
      let s = map.get(slug);
      if (!s) {
        s = new Set<string>();
        map.set(slug, s);
      }
      s.add(sid);
    };

    for (const e of data) {
      const sid = e.session_id;
      if (!sid) continue;
      const rawTs = e.occurred_at ?? e.created_at;
      if (!rawTs) continue;
      const ts = new Date(rawTs).getTime();
      if (Number.isNaN(ts)) continue;
      const dayIndex = WINDOW_DAYS - 1 - Math.floor((now - ts) / DAY_MS);

      if (e.event_name === 'cocktail_opened') {
        viewSessions.add(sid);
        if (dayIndex >= 0 && dayIndex < WINDOW_DAYS) viewsByDaySets[dayIndex].add(sid);
        hourSets[new Date(ts).getUTCHours()].add(sid);
        if (e.cocktail_slug) addTo(itemViewSessions, e.cocktail_slug, sid);
      } else if (e.event_name === 'order_completed') {
        const qty = typeof e.value_num === 'number' ? e.value_num : 1;
        const econ = e.cocktail_slug ? econBySlug.get(e.cocktail_slug) : undefined;
        const meta = (e.metadata ?? {}) as {
          revenue?: number; profit?: number; priceAtOrder?: number; costAtOrder?: number;
          // legacy keys
          revenueILS?: number; unitPriceILS?: number;
        };
        // Prefer values SNAPSHOT at order time; fall back to current economics.
        const unitPrice = meta.priceAtOrder ?? meta.unitPriceILS ?? econ?.price ?? 0;
        const unitCost = meta.costAtOrder ?? econ?.cost ?? 0;
        const revenue = meta.revenue ?? meta.revenueILS ?? qty * unitPrice;
        const profit = meta.profit ?? revenue - qty * unitCost;

        orderSessions.add(sid);
        totalUnits += qty;
        totalRevenue += revenue;
        totalProfit += profit;
        if (dayIndex >= 0 && dayIndex < WINDOW_DAYS) ordersByDaySets[dayIndex].add(sid);
        if (e.cocktail_slug) {
          addTo(itemOrderSessions, e.cocktail_slug, sid);
          itemUnits.set(e.cocktail_slug, (itemUnits.get(e.cocktail_slug) ?? 0) + qty);
          itemRevenue.set(e.cocktail_slug, (itemRevenue.get(e.cocktail_slug) ?? 0) + revenue);
        }
      }
    }

    const totalViews = viewSessions.size;
    const totalOrders = orderSessions.size;
    const viewsByDay = viewsByDaySets.map((s) => s.size);
    const ordersByDay = ordersByDaySets.map((s) => s.size);
    const hourCounts = hourSets.map((s) => s.size);
    const maxHour = Math.max(1, ...hourCounts);
    const hourHeatmap = hourCounts.map((v) => v / maxHour);

    const slugs = new Set<string>([...itemViewSessions.keys(), ...itemOrderSessions.keys()]);
    const topItems: TopItem[] = [...slugs]
      .map((slug) => {
        const views = itemViewSessions.get(slug)?.size ?? 0;
        const orders = itemOrderSessions.get(slug)?.size ?? 0;
        return {
          slug,
          views,
          orders,
          units: itemUnits.get(slug) ?? 0,
          conversionPct: views > 0 ? (orders / views) * 100 : 0,
          revenue: Math.round(itemRevenue.get(slug) ?? 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.views - a.views);

    return {
      totalViews,
      totalOrders,
      totalUnits,
      conversionPct: totalViews > 0 ? (totalOrders / totalViews) * 100 : 0,
      totalRevenue: Math.round(totalRevenue),
      totalProfit: Math.round(totalProfit),
      topItemSlug: topItems[0]?.slug ?? null,
      viewsByDay,
      ordersByDay,
      hourHeatmap,
      topItems,
      hasData: totalViews > 0 || totalOrders > 0,
    };
  } catch (e) {
    log.error('analytics', 'getAnalyticsOverview failed', {
      scope: 'getAnalyticsOverview',
      error: e instanceof Error ? e.message : String(e),
    });
    return emptyOverview();
  }
}

/** Per-cocktail engagement as DISTINCT SESSIONS per signal (+ unit quantity). */
interface EngagementSets {
  views: Set<string>;
  ingredients: Set<string>;
  breakdown: Set<string>;
  fullyViewed: Set<string>;
  shares: Set<string>;
  favorites: Set<string>;
  orders: Set<string>;
  units: number;
}

/**
 * Raw Event Inspector source — the most recent events, optionally filtered by
 * event_name or session_id. Lets an operator verify capture/aggregation by hand
 * (so when a number looks off you can see exactly which events produced it).
 */
export async function getRawEvents(
  opts: { eventName?: string; sessionId?: string; limit?: number } = {},
  restaurantSlug: string = TENANT_SLUG,
): Promise<RawEventsResult> {
  const empty: RawEventsResult = { events: [], eventNames: [], total: 0 };
  try {
    const supabase = await readClient();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return empty;

    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    let query = supabase
      .from('events')
      .select(
        'id, event_name, cocktail_slug, session_id, table_id, device_type, language, value_num, metadata, occurred_at, created_at',
      )
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (opts.eventName) query = query.eq('event_name', opts.eventName);
    if (opts.sessionId) query = query.eq('session_id', opts.sessionId);

    const { data } = await query;
    const events = (data ?? []) as RawEvent[];

    // Filter-dropdown options come from the static event taxonomy, NOT a table scan:
    // every stored event_name is whitelist-validated against it at ingest, so the taxonomy
    // is always a superset — this drops a second ≤50k-row scan on every Inspector load.
    const eventNames = [...TRACK_EVENTS].sort();

    return { events, eventNames, total: events.length };
  } catch (e) {
    log.error('analytics', 'getRawEvents failed', {
      scope: 'getRawEvents',
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}

/**
 * Data Integrity Validator — asserts the funnel invariants that MUST hold when
 * everything is counted as distinct sessions. Any violation means a bug in
 * capture or aggregation (not "interesting data").
 */
export async function getIntegrityReport(restaurantSlug: string = TENANT_SLUG): Promise<IntegrityReport> {
  const empty: IntegrityReport = { totalEvents: 0, checks: [], issues: [] as IntegrityReport['issues'], allPassed: true };
  try {
    const supabase = await readClient();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return empty;

    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id);

    const funnels = await getCocktailFunnels(restaurantSlug);
    const issues: IntegrityReport['issues'] = [];

    // Per-cocktail invariants (distinct-session counting guarantees these).
    const rules: { name: string; check: (r: (typeof funnels)[number]) => boolean }[] = [
      { name: 'Orders ≤ Opens', check: (r) => r.ordered <= r.opened },
      { name: 'Ingredients ≤ Opens', check: (r) => r.ingredients <= r.opened },
      { name: '360/AR ≤ Opens', check: (r) => r.breakdown <= r.opened },
      { name: 'Called waiter ≤ Opens', check: (r) => r.called <= r.opened },
      { name: 'Units ≥ Orders', check: (r) => r.units >= r.ordered },
    ];

    const checks = rules.map((rule) => {
      let passed = true;
      for (const row of funnels) {
        if (!rule.check(row)) {
          passed = false;
          issues.push({
            slug: row.cocktailSlug,
            rule: rule.name,
            detail: `seen=${row.seen} opened=${row.opened} ingredients=${row.ingredients} 360/ar=${row.breakdown} called=${row.called} ordered=${row.ordered} units=${row.units}`,
          });
        }
      }
      return { name: rule.name, passed };
    });

    return {
      totalEvents: count ?? 0,
      checks,
      issues,
      allPassed: checks.every((c) => c.passed),
    };
  } catch (e) {
    log.error('analytics', 'getIntegrityReport failed', {
      scope: 'getIntegrityReport',
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}

// Exported only so the pure quadrant logic can be unit-tested directly (see
// queries.test.ts). Behavior is unchanged — this is the classic menu-engineering
// Star/Plowhorse/Puzzle/Dog assignment around the demand & margin medians.
export function classify(demand: number, margin: number, medDemand: number, medMargin: number): MenuClass {
  // Require real demand to be "popular" — avoids the all-zero-median collapse
  // where a drink nobody orders would read as a Star.
  const popular = demand >= Math.max(1, medDemand);
  const profitable = margin >= medMargin;
  if (popular && profitable) return 'star';
  if (popular && !profitable) return 'plowhorse';
  if (!popular && profitable) return 'puzzle';
  return 'dog';
}

/**
 * Menu engineering: combine each menu item's economics (price/cost/margin) with
 * its real demand + engagement from events, then classify into the classic
 * Star / Plowhorse / Puzzle / Dog quadrants and surface an Attention Score.
 */
export async function getMenuEngineering(
  restaurantSlug: string = TENANT_SLUG,
): Promise<MenuEngineering> {
  const empty: MenuEngineering = { items: [], medianDemand: 0, medianMargin: 0, hasData: false };
  try {
    const supabase = await readClient();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return empty;

    // Paginated: a plain .limit(50000) was capped at 1000 by PostgREST, so once a
    // restaurant passed 1000 events the OLDEST — including whole order_completed
    // history — vanished and demand read 0. See fetchAllEvents.
    const data = await fetchAllEvents<{
      event_name: string;
      cocktail_slug: string | null;
      value_num: number | null;
      session_id: string | null;
    }>(supabase, restaurant.id, 'event_name, cocktail_slug, value_num, session_id');

    // Real POS sales (uploaded via CSV → the `sales` table) are the AUTHORITATIVE
    // demand signal. Menu engineering is fundamentally "what SELLS"; the axis was
    // reading order_completed EVENTS (in-app pick intent), so the numbers the owner
    // actually uploaded never moved the quadrants — and the screen still claimed
    // "real demand". Prefer the sales table; fall back to intent only when no sales
    // exist yet, so an install with no POS import still gets a demand axis.
    const { data: salesRows } = await supabase
      .from('sales')
      .select('slug, units')
      .eq('restaurant_id', restaurant.id);
    const realSales = new Map<string, number>();
    for (const r of (salesRows ?? []) as Array<{ slug: string; units: number }>) {
      realSales.set(r.slug, (realSales.get(r.slug) ?? 0) + (Number(r.units) || 0));
    }
    const hasRealSales = [...realSales.values()].some((u) => u > 0);

    const agg = new Map<string, EngagementSets>();
    const ensure = (slug: string): EngagementSets => {
      let a = agg.get(slug);
      if (!a) {
        a = {
          views: new Set(), ingredients: new Set(), breakdown: new Set(),
          fullyViewed: new Set(), shares: new Set(), favorites: new Set(),
          orders: new Set(), units: 0,
        };
        agg.set(slug, a);
      }
      return a;
    };

    for (const e of data ?? []) {
      if (!e.cocktail_slug || !e.session_id) continue;
      const a = ensure(e.cocktail_slug);
      const sid = e.session_id;
      switch (e.event_name) {
        case 'cocktail_opened': a.views.add(sid); break;
        case 'ingredients_opened': a.ingredients.add(sid); break;
        case '360_opened':
        case 'ar_opened': a.breakdown.add(sid); break;
        case 'cocktail_fully_viewed': a.fullyViewed.add(sid); break;
        case 'cocktail_shared': a.shares.add(sid); break;
        case 'cocktail_favorited': a.favorites.add(sid); break;
        case 'order_completed':
          a.orders.add(sid);
          a.units += typeof e.value_num === 'number' ? e.value_num : 1;
          break;
        default: break;
      }
    }

    // Engagement = weighted DISTINCT-SESSION signals (deeper actions weigh more).
    const rawEngagement = (a: EngagementSets): number =>
      a.views.size + a.ingredients.size * 2 + a.breakdown.size * 3 +
      a.fullyViewed.size * 2 + a.shares.size * 4 + a.favorites.size * 3;

    const maxEngagement = Math.max(1, ...MENU.map((c) => rawEngagement(ensure(c.slug))));

    const base = MENU.map((cocktail) => {
      const a = ensure(cocktail.slug);
      const econ = getEconomics(cocktail);
      // Demand = real units sold when the owner has uploaded sales; otherwise the
      // in-app order-intent count (a.units) so the plot isn't empty pre-import.
      const demand = hasRealSales ? realSales.get(cocktail.slug) ?? 0 : a.units;
      return { cocktail, a, econ, demand };
    });

    const medDemand = median(base.map((b) => b.demand));
    const medMargin = median(base.map((b) => b.econ.margin));

    const items: MenuEngineeringItem[] = base
      .map(({ cocktail, a, econ, demand }) => {
        const views = a.views.size;
        const orders = a.orders.size;
        const attentionScore = Math.round((rawEngagement(a) / maxEngagement) * 100);
        const conversionPct = views > 0 ? (orders / views) * 100 : 0;
        return {
          slug: cocktail.slug,
          price: econ.price,
          cost: econ.cost,
          margin: econ.margin,
          marginPct: econ.marginPct,
          views,
          orders,
          // The plotted demand axis + quadrant share one basis (real sales when
          // uploaded, else intent), so the dot's X position and its Star/Dog class agree.
          units: demand,
          conversionPct,
          attentionScore,
          klass: classify(demand, econ.margin, medDemand, medMargin),
          highInterestLowConversion: attentionScore >= 55 && conversionPct < 10 && views >= 2,
        };
      })
      .sort((x, y) => y.attentionScore - x.attentionScore || y.margin - x.margin);

    return {
      items,
      medianDemand: medDemand,
      medianMargin: medMargin,
      hasData: (data ?? []).length > 0 || hasRealSales,
    };
  } catch (e) {
    log.error('analytics', 'getMenuEngineering failed', {
      scope: 'getMenuEngineering',
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}
