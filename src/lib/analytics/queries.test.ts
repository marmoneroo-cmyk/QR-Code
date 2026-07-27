import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { TRACK_EVENTS } from '@/lib/tracking/taxonomy';

// The query functions build their own service-role client via createAdminSupabase().
// Replace it with a tiny in-memory mock so we can drive the PURE aggregation/reduction
// logic (session-dedup, revenue snapshot fallback, funnel flags, classify quadrants)
// with hand-built fixtures — no network, no Supabase.
vi.mock('@/lib/supabase/server', () => ({ createAdminSupabase: vi.fn() }));

import { createAdminSupabase } from '@/lib/supabase/server';
import {
  classify,
  getAnalyticsOverview,
  getCocktailFunnels,
  getMenuEngineering,
  getRawEvents,
  getIntegrityReport,
} from './queries';

// --- Minimal chainable Supabase mock ---------------------------------------
// A builder whose chain methods return `this`, that is awaitable (thenable), and
// whose terminal value is resolved from the fixtures keyed by table. `select(cols,
// { head: true })` is how the code asks for a COUNT — we surface it as `count`.

interface TerminalResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

interface MockHandlers {
  /** restaurants.select('id').eq('slug', …).maybeSingle() */
  restaurant?: { id: string } | null;
  /** events.select(…).eq(…)…  (the non-count events read) */
  events?: TerminalResult;
  /** events.select('id', { count:'exact', head:true }) */
  eventsCount?: number;
  /** cocktail_funnel.select('*').eq(…) */
  cocktail_funnel?: TerminalResult;
  /** sales.select('slug, units').eq(…) — real POS demand for menu engineering */
  sales?: TerminalResult;
}

function makeBuilder(resolve: (head: boolean) => TerminalResult) {
  const state = { head: false };
  const run = () => Promise.resolve(resolve(state.head));
  const builder = {
    select(_columns?: string, opts?: { head?: boolean; count?: string }) {
      if (opts?.head) state.head = true;
      return builder;
    },
    eq() {
      return builder;
    },
    in() {
      return builder;
    },
    gte() {
      return builder;
    },
    lte() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    // Paginated reads (fetchAllEvents) resolve the fixture; small fixtures return
    // a short first page so the pagination loop stops after one round.
    range() {
      return run();
    },
    maybeSingle() {
      return run();
    },
    then<A, B = never>(
      onfulfilled?: ((value: TerminalResult) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ) {
      return run().then(onfulfilled, onrejected);
    },
  };
  return builder;
}

function resolveTable(handlers: MockHandlers, table: string, head: boolean): TerminalResult {
  if (table === 'restaurants') return { data: handlers.restaurant ?? null, error: null };
  if (table === 'events') {
    if (head) return { count: handlers.eventsCount ?? 0, error: null };
    return handlers.events ?? { data: [], error: null };
  }
  if (table === 'cocktail_funnel') return handlers.cocktail_funnel ?? { data: [], error: null };
  if (table === 'sales') return handlers.sales ?? { data: [], error: null };
  return { data: [], error: null };
}

function mockSupabase(handlers: MockHandlers): void {
  const client = {
    from(table: string) {
      return makeBuilder((head) => resolveTable(handlers, table, head));
    },
  };
  vi.mocked(createAdminSupabase).mockReturnValue(client as unknown as SupabaseServerClient);
}

const isoNow = (): string => new Date().toISOString();

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
describe('classify — menu-engineering quadrant logic', () => {
  it('assigns Star to a popular, profitable item', () => {
    // demand ≥ max(1, medDemand) AND margin ≥ medMargin
    expect(classify(2, 50, 1, 40)).toBe('star');
  });

  it('assigns Plowhorse to a popular but unprofitable item', () => {
    expect(classify(2, 30, 1, 40)).toBe('plowhorse');
  });

  it('assigns Puzzle to a profitable item nobody orders', () => {
    expect(classify(0, 50, 1, 40)).toBe('puzzle');
  });

  it('assigns Dog to an unpopular, unprofitable item', () => {
    expect(classify(0, 30, 1, 40)).toBe('dog');
  });

  it('treats the medians as inclusive at the boundary', () => {
    // demand == max(1, medDemand) and margin == medMargin both count as "in".
    expect(classify(1, 40, 1, 40)).toBe('star');
  });

  it('never reads a zero-order item as a Star even when every median is zero', () => {
    // The all-zero-median collapse: without the max(1, medDemand) floor, a drink
    // nobody orders (demand 0) would clear demand ≥ 0 and read as a Star.
    expect(classify(0, 100, 0, 0)).not.toBe('star');
    expect(classify(0, 100, 0, 0)).toBe('puzzle'); // profitable but not popular
  });
});

// ---------------------------------------------------------------------------
describe('getAnalyticsOverview — revenue / orders aggregation', () => {
  it('aggregates unique visits, units, revenue and profit across sessions', async () => {
    // s1 opens twice (dedup → 1 view) and orders qty 2 with a SNAPSHOT (revenue/profit
    // captured at order time). s2 opens once and orders qty 1 with EMPTY metadata
    // (falls back to current economics). s3 only browses.
    mockSupabase({
      restaurant: { id: 'r1' },
      events: {
        data: [
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 's1', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 's1', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'order_completed', cocktail_slug: 'smoked-old-fashioned', session_id: 's1', value_num: 2, metadata: { revenue: 200, profit: 150 }, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 's2', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'order_completed', cocktail_slug: 'smoked-old-fashioned', session_id: 's2', value_num: 1, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'cocktail_opened', cocktail_slug: 'garden-spritz', session_id: 's3', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
        ],
        error: null,
      },
    });

    const o = await getAnalyticsOverview();

    expect(o.hasData).toBe(true);
    expect(o.totalViews).toBe(3); // distinct opening sessions: s1, s2, s3
    expect(o.totalOrders).toBe(2); // distinct ordering sessions: s1, s2
    expect(o.totalUnits).toBe(3); // 2 + 1
    // Revenue: 200 (snapshot) + 68 (1 × current price of smoked-old-fashioned) = 268
    expect(o.totalRevenue).toBe(268);
    // Profit: 150 (snapshot) + (68 − 1 × cost 20) = 150 + 48 = 198
    expect(o.totalProfit).toBe(198);
    expect(o.conversionPct).toBeCloseTo((2 / 3) * 100, 5);
    expect(o.topItemSlug).toBe('smoked-old-fashioned');
  });

  it('counts a repeated open in one session only once (session dedup)', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      events: {
        data: [
          { event_name: 'cocktail_opened', cocktail_slug: 'diner-negroni', session_id: 'dup', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'cocktail_opened', cocktail_slug: 'diner-negroni', session_id: 'dup', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'cocktail_opened', cocktail_slug: 'diner-negroni', session_id: 'dup', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
        ],
        error: null,
      },
    });

    const o = await getAnalyticsOverview();

    expect(o.totalViews).toBe(1);
    const negroni = o.topItems.find((i) => i.slug === 'diner-negroni');
    expect(negroni?.views).toBe(1);
  });

  it('falls back to legacy snapshot keys (revenueILS / unitPriceILS) when present', async () => {
    // No modern revenue/priceAtOrder keys — the legacy fallback chain must still fire.
    mockSupabase({
      restaurant: { id: 'r1' },
      events: {
        data: [
          { event_name: 'cocktail_opened', cocktail_slug: 'diner-margarita', session_id: 's1', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'order_completed', cocktail_slug: 'diner-margarita', session_id: 's1', value_num: 2, metadata: { unitPriceILS: 100 }, occurred_at: isoNow(), created_at: isoNow() },
        ],
        error: null,
      },
    });

    const o = await getAnalyticsOverview();

    // revenue = qty(2) × unitPriceILS(100) = 200
    expect(o.totalRevenue).toBe(200);
    // profit = 200 − qty(2) × cost(16 for diner-margarita) = 200 − 32 = 168
    expect(o.totalProfit).toBe(168);
    expect(o.totalUnits).toBe(2);
  });

  it('defaults a missing order quantity to a single unit', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      events: {
        data: [
          { event_name: 'order_completed', cocktail_slug: 'diner-pinky', session_id: 's1', value_num: null, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
        ],
        error: null,
      },
    });

    const o = await getAnalyticsOverview();

    expect(o.totalUnits).toBe(1);
    // diner-pinky: price 56, cost 14 → revenue 56, profit 42
    expect(o.totalRevenue).toBe(56);
    expect(o.totalProfit).toBe(42);
  });

  it('prefers REAL POS sales over in-app order events for money and units', async () => {
    // The bug this locks: Home/Revenue/Executive read only `events`, so an owner who
    // imported sales saw ₪1,350 there and ₪55,895 on the Sales screen — same label,
    // 41× apart. Sales win; the in-app order event below must not be added on top.
    mockSupabase({
      restaurant: { id: 'r1' },
      sales: {
        data: [
          { slug: 'diner-negroni', units: 100, revenue: 6200 }, // price 62, cost 20
          { slug: 'garden-spritz', units: 50, revenue: 2100 }, // price 42, cost 10
        ],
        error: null,
      },
      events: {
        data: [
          { event_name: 'cocktail_opened', cocktail_slug: 'diner-negroni', session_id: 's1', value_num: null, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'order_completed', cocktail_slug: 'diner-negroni', session_id: 's1', value_num: 3, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
        ],
        error: null,
      },
    });

    const o = await getAnalyticsOverview();

    expect(o.totalUnits).toBe(150); // 100 + 50 from SALES, not the 3 in-app units
    expect(o.totalRevenue).toBe(8300); // 6200 + 2100
    expect(o.totalProfit).toBe(8300 - (20 * 100 + 10 * 50)); // revenue − cost×units
    // Views/orders stay behavioural — a POS row carries no session.
    expect(o.totalViews).toBe(1);
    expect(o.hasData).toBe(true);
  });

  it('lists a sold-but-never-viewed item so a real seller cannot go missing', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      sales: { data: [{ slug: 'diner-margarita', units: 9, revenue: 522 }], error: null },
      events: { data: [], error: null },
    });

    const o = await getAnalyticsOverview();
    const margarita = o.topItems.find((i) => i.slug === 'diner-margarita');

    expect(margarita).toBeDefined();
    expect(margarita?.units).toBe(9);
    expect(margarita?.views).toBe(0);
    expect(o.hasData).toBe(true); // sales alone are enough to have data
  });

  it('falls back to in-app order events when the tenant has no sales at all', async () => {
    // A tenant that never imported a POS file must keep its old behaviour.
    mockSupabase({
      restaurant: { id: 'r1' },
      sales: { data: [], error: null },
      events: {
        data: [
          { event_name: 'order_completed', cocktail_slug: 'diner-pinky', session_id: 's1', value_num: 2, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
        ],
        error: null,
      },
    });

    const o = await getAnalyticsOverview();

    expect(o.totalUnits).toBe(2); // diner-pinky price 56 / cost 14
    expect(o.totalRevenue).toBe(112);
    expect(o.totalProfit).toBe(84);
  });

  it('ignores a sales row whose units are zero (revenue-only noise)', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      sales: { data: [{ slug: 'diner-pinky', units: 0, revenue: 0 }], error: null },
      events: {
        data: [
          { event_name: 'order_completed', cocktail_slug: 'diner-pinky', session_id: 's1', value_num: 1, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
        ],
        error: null,
      },
    });

    const o = await getAnalyticsOverview();
    expect(o.totalUnits).toBe(1); // no real sales → event fallback still applies
  });

  it('ranks top items by revenue and normalizes the hour heatmap', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      events: {
        data: [
          // cheaper drink, ordered — lower revenue
          { event_name: 'cocktail_opened', cocktail_slug: 'garden-spritz', session_id: 'a', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'order_completed', cocktail_slug: 'garden-spritz', session_id: 'a', value_num: 1, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
          // pricier drink, ordered — higher revenue → should rank first
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 'b', value_num: null, metadata: null, occurred_at: isoNow(), created_at: isoNow() },
          { event_name: 'order_completed', cocktail_slug: 'smoked-old-fashioned', session_id: 'b', value_num: 1, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
        ],
        error: null,
      },
    });

    const o = await getAnalyticsOverview();

    expect(o.topItems[0]?.slug).toBe('smoked-old-fashioned');
    expect(o.topItems[0]!.revenue).toBeGreaterThan(o.topItems[1]!.revenue);
    expect(o.hourHeatmap).toHaveLength(24);
    expect(Math.max(...o.hourHeatmap)).toBe(1); // busiest hour normalized to 1
    expect(o.viewsByDay).toHaveLength(30);
    expect(o.ordersByDay).toHaveLength(30);
  });

  it('returns the empty overview when the tenant is unknown', async () => {
    mockSupabase({ restaurant: null });

    const o = await getAnalyticsOverview();

    expect(o.hasData).toBe(false);
    expect(o.totalViews).toBe(0);
    expect(o.totalRevenue).toBe(0);
    expect(o.viewsByDay).toHaveLength(30);
    expect(o.hourHeatmap).toHaveLength(24);
  });

  it('returns the empty overview when there are no events', async () => {
    mockSupabase({ restaurant: { id: 'r1' }, events: { data: [], error: null } });

    const o = await getAnalyticsOverview();

    expect(o.hasData).toBe(false);
    expect(o.topItems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('getMenuEngineering — quadrant assignment over real economics', () => {
  it('wires demand × margin into Star / Plowhorse / Puzzle / Dog quadrants', async () => {
    // Median margin across the fixed MENU is 42; a sparse fixture keeps median demand
    // at 0, so any ordered item (units ≥ 1) is "popular".
    //  smoked-old-fashioned  margin 48 (≥42) + ordered → STAR
    //  garden-spritz         margin 32 (<42) + ordered → PLOWHORSE
    //  citrus-lime-sour      margin 42 (≥42) + viewed-not-ordered → PUZZLE
    //  diner-aperol-spritz   margin 40 (<42) + no engagement → DOG
    mockSupabase({
      restaurant: { id: 'r1' },
      events: {
        data: [
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 's1', value_num: null },
          { event_name: 'order_completed', cocktail_slug: 'smoked-old-fashioned', session_id: 's1', value_num: 2 },
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 's2', value_num: null },
          { event_name: 'order_completed', cocktail_slug: 'smoked-old-fashioned', session_id: 's2', value_num: 1 },
          { event_name: 'cocktail_opened', cocktail_slug: 'garden-spritz', session_id: 's3', value_num: null },
          { event_name: 'order_completed', cocktail_slug: 'garden-spritz', session_id: 's3', value_num: 1 },
          { event_name: 'cocktail_opened', cocktail_slug: 'citrus-lime-sour', session_id: 's4', value_num: null },
        ],
        error: null,
      },
    });

    const me = await getMenuEngineering();
    const bySlug = (slug: string) => me.items.find((i) => i.slug === slug);

    expect(me.hasData).toBe(true);
    expect(me.medianMargin).toBe(42);
    expect(me.medianDemand).toBe(0);
    expect(me.items).toHaveLength(10); // every MENU item is represented

    expect(bySlug('smoked-old-fashioned')?.klass).toBe('star');
    expect(bySlug('garden-spritz')?.klass).toBe('plowhorse');
    expect(bySlug('citrus-lime-sour')?.klass).toBe('puzzle');
    expect(bySlug('diner-aperol-spritz')?.klass).toBe('dog');
  });

  it('counts distinct sessions per signal and sums order units', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      events: {
        data: [
          // one session opens twice (dedup) and orders qty 2
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 's1', value_num: null },
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 's1', value_num: null },
          { event_name: 'order_completed', cocktail_slug: 'smoked-old-fashioned', session_id: 's1', value_num: 2 },
          // a second session opens and orders qty 1
          { event_name: 'cocktail_opened', cocktail_slug: 'smoked-old-fashioned', session_id: 's2', value_num: null },
          { event_name: 'order_completed', cocktail_slug: 'smoked-old-fashioned', session_id: 's2', value_num: 1 },
        ],
        error: null,
      },
    });

    const me = await getMenuEngineering();
    const star = me.items.find((i) => i.slug === 'smoked-old-fashioned');

    expect(star?.views).toBe(2); // s1 (deduped) + s2
    expect(star?.orders).toBe(2);
    expect(star?.units).toBe(3); // 2 + 1
    expect(star?.conversionPct).toBe(100); // 2 orders / 2 views
    expect(star?.attentionScore).toBe(100); // most-engaging item → normalized to 100
  });

  it('drives demand from REAL uploaded sales, ignoring in-app order intent', async () => {
    // The bug this locks: uploaded POS sales (the `sales` table) never moved the
    // quadrants because demand read order_completed EVENTS instead. When sales
    // exist they are authoritative; the intent event below must be ignored.
    mockSupabase({
      restaurant: { id: 'r1' },
      sales: {
        data: [
          { slug: 'smoked-old-fashioned', units: 5 }, // real sales → popular
          { slug: 'garden-spritz', units: 3 }, // real sales, low margin → plowhorse
        ],
        error: null,
      },
      events: {
        // intent for a DIFFERENT drink — must NOT count as demand now that sales exist
        data: [{ event_name: 'order_completed', cocktail_slug: 'citrus-lime-sour', session_id: 's1', value_num: 9 }],
        error: null,
      },
    });

    const me = await getMenuEngineering();
    const bySlug = (slug: string) => me.items.find((i) => i.slug === slug);

    expect(me.hasData).toBe(true);
    expect(bySlug('smoked-old-fashioned')?.units).toBe(5); // from sales, not events
    expect(bySlug('garden-spritz')?.units).toBe(3);
    expect(bySlug('citrus-lime-sour')?.units).toBe(0); // intent ignored — no sales row
    expect(bySlug('smoked-old-fashioned')?.klass).toBe('star'); // 5 sold + margin 48
    expect(bySlug('garden-spritz')?.klass).toBe('plowhorse'); // 3 sold + margin 32
    expect(bySlug('citrus-lime-sour')?.klass).toBe('puzzle'); // 0 sold + margin 42
  });

  it('returns the empty result when the tenant is unknown', async () => {
    mockSupabase({ restaurant: null });

    const me = await getMenuEngineering();

    expect(me).toEqual({ items: [], medianDemand: 0, medianMargin: 0, hasData: false });
  });
});

// ---------------------------------------------------------------------------
describe('getCocktailFunnels — units join and leak / high-converter flags', () => {
  const funnelRows = [
    // A: strong converter — 40% of 100 entries order.
    { cocktail_slug: 'smoked-old-fashioned', seen: 100, opened: 100, ingredients: 50, breakdown: 10, called: 5, ordered: 40 },
    // B: leak — lots of ingredient interest (80%) but almost nobody orders (1%).
    { cocktail_slug: 'diner-negroni', seen: 100, opened: 100, ingredients: 80, breakdown: 20, called: 5, ordered: 1 },
    // C: below the sample floor (entry 2 < 4) — never flagged.
    { cocktail_slug: 'garden-spritz', seen: 2, opened: 2, ingredients: 1, breakdown: 0, called: 0, ordered: 1 },
  ];

  it('flags a high converter, a leak, and leaves a low-sample row unflagged', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      cocktail_funnel: { data: funnelRows, error: null },
      events: {
        // order_completed rows drive the UNITS total (sum of value_num).
        data: [
          { cocktail_slug: 'smoked-old-fashioned', value_num: 3 },
          { cocktail_slug: 'smoked-old-fashioned', value_num: 2 },
          { cocktail_slug: 'diner-negroni', value_num: 1 },
        ],
        error: null,
      },
    });

    const funnels = await getCocktailFunnels();
    const bySlug = (slug: string) => funnels.find((f) => f.cocktailSlug === slug);

    expect(bySlug('smoked-old-fashioned')?.flag).toBe('high_converter');
    expect(bySlug('smoked-old-fashioned')?.units).toBe(5); // 3 + 2
    expect(bySlug('diner-negroni')?.flag).toBe('leak');
    expect(bySlug('garden-spritz')?.flag).toBeNull(); // entry below LEAK_SAMPLE_MIN
  });

  it('sorts rows by seen descending', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      cocktail_funnel: { data: funnelRows, error: null },
      events: { data: [], error: null },
    });

    const funnels = await getCocktailFunnels();
    const seen = funnels.map((f) => f.seen);
    expect(seen).toEqual([...seen].sort((a, b) => b - a));
  });

  it('defaults an order with no quantity to a single unit', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      cocktail_funnel: { data: [{ cocktail_slug: 'diner-pinky', seen: 10, opened: 10, ingredients: 2, breakdown: 0, called: 0, ordered: 3 }], error: null },
      events: { data: [{ cocktail_slug: 'diner-pinky', value_num: null }], error: null },
    });

    const funnels = await getCocktailFunnels();
    expect(funnels.find((f) => f.cocktailSlug === 'diner-pinky')?.units).toBe(1);
  });

  it('returns [] when the funnel view errors', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      cocktail_funnel: { data: null, error: { message: 'missing view' } },
    });

    expect(await getCocktailFunnels()).toEqual([]);
  });

  it('returns [] when the tenant is unknown', async () => {
    mockSupabase({ restaurant: null });
    expect(await getCocktailFunnels()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('getRawEvents — inspector passthrough', () => {
  it('returns the events plus the taxonomy-derived event-name list', async () => {
    const rows = [
      { id: 1, event_name: 'order_completed', cocktail_slug: 'diner-negroni', session_id: 's1', table_id: null, device_type: 'mobile', language: 'he', value_num: 1, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
      { id: 2, event_name: 'cocktail_opened', cocktail_slug: 'diner-negroni', session_id: 's1', table_id: null, device_type: 'mobile', language: 'he', value_num: null, metadata: {}, occurred_at: isoNow(), created_at: isoNow() },
    ];
    mockSupabase({ restaurant: { id: 'r1' }, events: { data: rows, error: null } });

    const result = await getRawEvents();

    expect(result.total).toBe(2);
    expect(result.events).toHaveLength(2);
    // Dropdown options come from the static taxonomy (a superset), sorted.
    expect(result.eventNames).toEqual([...TRACK_EVENTS].sort());
  });

  it('returns the empty result when the tenant is unknown', async () => {
    mockSupabase({ restaurant: null });

    const result = await getRawEvents();

    expect(result).toEqual({ events: [], eventNames: [], total: 0 });
  });
});

// ---------------------------------------------------------------------------
describe('getIntegrityReport — funnel invariants', () => {
  it('passes every check when the funnel is internally consistent', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      eventsCount: 500,
      cocktail_funnel: {
        data: [{ cocktail_slug: 'smoked-old-fashioned', seen: 100, opened: 100, ingredients: 40, breakdown: 10, called: 5, ordered: 30 }],
        error: null,
      },
      events: { data: [{ cocktail_slug: 'smoked-old-fashioned', value_num: 35 }], error: null },
    });

    const report = await getIntegrityReport();

    expect(report.totalEvents).toBe(500);
    expect(report.allPassed).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('flags a violation when orders exceed opens', async () => {
    mockSupabase({
      restaurant: { id: 'r1' },
      eventsCount: 10,
      cocktail_funnel: {
        // ordered (50) > opened (10) — an impossible distinct-session funnel.
        data: [{ cocktail_slug: 'diner-negroni', seen: 20, opened: 10, ingredients: 5, breakdown: 2, called: 1, ordered: 50 }],
        error: null,
      },
      events: { data: [{ cocktail_slug: 'diner-negroni', value_num: 60 }], error: null },
    });

    const report = await getIntegrityReport();

    expect(report.allPassed).toBe(false);
    expect(report.issues.some((i) => i.rule === 'Orders ≤ Opens' && i.slug === 'diner-negroni')).toBe(true);
  });
});
