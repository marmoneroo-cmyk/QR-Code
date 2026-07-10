import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { log } from '@/lib/log';
import type {
  HealthItem, HealthStatus, PercentileStats, QualityCheck, SignalBlock, SignalVerification,
} from './signals-types';

const TENANT_SLUG = 'diner';
const DAY_MS = 24 * 60 * 60 * 1000;

interface Row {
  event_name: string | null;
  session_id: string | null;
  visitor_id?: string | null;
  cocktail_slug: string | null;
  table_id: string | null;
  value_num: number | null;
  metadata: unknown;
  created_at: string;
}

const EMPTY_STATS: PercentileStats = { count: 0, avg: 0, p50: 0, p75: 0, p90: 0, p95: 0, min: 0, max: 0 };
const EMPTY_BLOCK: SignalBlock = { stats: EMPTY_STATS, invalidPct: 0, missingPct: 0, status: 'warning' };

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function stats(values: number[]): PercentileStats {
  if (values.length === 0) return EMPTY_STATS;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    count: sorted.length,
    avg: Math.round((sum / sorted.length) * 10) / 10,
    p50: percentile(sorted, 50), p75: percentile(sorted, 75),
    p90: percentile(sorted, 90), p95: percentile(sorted, 95),
    min: sorted[0], max: sorted[sorted.length - 1],
  };
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function visitorOf(r: Row): string | null {
  if (r.visitor_id) return r.visitor_id;
  const meta = (r.metadata ?? {}) as { visitorId?: string };
  return meta.visitorId ?? null;
}

const SELECT = 'event_name, session_id, cocktail_slug, table_id, value_num, metadata, created_at';

export async function getSignalVerification(restaurantSlug: string = TENANT_SLUG): Promise<SignalVerification> {
  const empty: SignalVerification = {
    totalEvents: 0, collectedSinceDays: null, hasVisitorColumn: false,
    readiness: { ready: false, consecutiveReadyDays: 0, requiredDays: 7, blockedBy: ['no data yet'] },
    trends: [], drift: [],
    dwell: EMPTY_BLOCK, scrollDepth: { ...EMPTY_BLOCK, full100Pct: 0 },
    favorites: { events: 0, addEvents: 0, removeEvents: 0, distinctItems: 0, addRatePct: 0, removeRatePct: 0, status: 'warning' },
    identity: { uniqueVisitors: 0, uniqueSessions: 0, totalEvents: 0, visitorCoveragePct: 0, returnVisitors: 0, sessionsPerVisitor: 0, maxEventsPerVisitor: 0, maxEventsPerSession: 0, avgEventsPerSession: 0, status: 'warning' },
    instrumentationHealth: [], quality: [],
  };

  try {
    const supabase = createAdminSupabase();
    const { data: restaurant } = await supabase
      .from('restaurants').select('id').eq('slug', restaurantSlug).maybeSingle();
    if (!restaurant?.id) return empty;

    let hasVisitorColumn = true;
    let rows: Row[];
    const withCol = await supabase.from('events').select(`${SELECT}, visitor_id`).eq('restaurant_id', restaurant.id).limit(50000);
    if (withCol.error) {
      hasVisitorColumn = false;
      const without = await supabase.from('events').select(SELECT).eq('restaurant_id', restaurant.id).limit(50000);
      rows = (without.data ?? []) as Row[];
    } else {
      rows = (withCol.data ?? []) as Row[];
    }
    if (rows.length === 0) return { ...empty, hasVisitorColumn };

    const now = Date.now();
    // Locked windows (doc §14.2): recent = last 7d · trend-prior = 7–14d ·
    // drift-baseline = prior 30d (7–37d).
    const RECENT_DAYS = 7;
    const TREND_PRIOR_DAYS = 14;
    const DRIFT_BASELINE_DAYS = 37;
    const recent = { events: 0, withVisitor: 0, withSource: 0, dwell: [] as number[], scroll: [] as number[], fav: 0 };
    const trendPrior = { events: 0, withVisitor: 0, withSource: 0 };
    const driftBase = { events: 0, dwell: [] as number[], scroll: [] as number[], fav: 0 };
    // Per-day (last 7 days) coverage for the consecutive-ready-days gate.
    const perDay = Array.from({ length: 7 }, () => ({ events: 0, withVisitor: 0, withSource: 0 }));

    const dwellVals: number[] = []; let dwellNull = 0; let dwellInvalid = 0;
    const scrollVals: number[] = []; let scrollNull = 0; let scrollInvalid = 0; let scroll100 = 0; let scrollTotal = 0;
    let favEvents = 0; let favAdd = 0; let favRemove = 0; const favItems = new Set<string>();
    let withSource = 0; let tableEvents = 0; let orderEvents = 0; let orderWithRevenue = 0;
    const evPerVisitor = new Map<string, number>(); const evPerSession = new Map<string, number>();
    const sessPerVisitor = new Map<string, Set<string>>(); let withVisitor = 0; let earliest = Infinity;

    for (const r of rows) {
      const ts = new Date(r.created_at).getTime();
      if (ts < earliest) earliest = ts;
      const meta = (r.metadata ?? {}) as { source?: string; action?: string };
      if (meta.source) withSource += 1;
      if (r.table_id) tableEvents += 1;

      switch (r.event_name) {
        case 'cocktail_dwell':
          if (typeof r.value_num !== 'number') dwellNull += 1;
          else if (r.value_num <= 0 || r.value_num > 7200) dwellInvalid += 1;
          else dwellVals.push(r.value_num);
          break;
        case 'cocktail_scroll_depth':
          scrollTotal += 1;
          if (typeof r.value_num !== 'number') scrollNull += 1;
          else if (r.value_num < 0 || r.value_num > 100) scrollInvalid += 1;
          else { scrollVals.push(r.value_num); if (r.value_num === 100) scroll100 += 1; }
          break;
        case 'cocktail_favorited':
          favEvents += 1;
          if (meta.action === 'remove' || r.value_num === 0) favRemove += 1; else favAdd += 1;
          if (r.cocktail_slug) favItems.add(r.cocktail_slug);
          break;
        case 'order_completed': {
          orderEvents += 1;
          const om = (r.metadata ?? {}) as { revenue?: number; revenueILS?: number; priceAtOrder?: number };
          if (typeof (om.revenue ?? om.revenueILS ?? om.priceAtOrder) === 'number') orderWithRevenue += 1;
          break;
        }
        default: break;
      }

      const vid = visitorOf(r);
      if (vid) {
        withVisitor += 1;
        evPerVisitor.set(vid, (evPerVisitor.get(vid) ?? 0) + 1);
        if (r.session_id) {
          let s = sessPerVisitor.get(vid); if (!s) { s = new Set(); sessPerVisitor.set(vid, s); } s.add(r.session_id);
        }
      }
      if (r.session_id) evPerSession.set(r.session_id, (evPerSession.get(r.session_id) ?? 0) + 1);

      // Time-window bucketing for trends, drift, and the readiness gate.
      const dayAgo = Math.floor((now - ts) / DAY_MS);
      const hasSrc = Boolean(meta.source);
      const isDwell = r.event_name === 'cocktail_dwell' && typeof r.value_num === 'number' && r.value_num > 0 && r.value_num <= 7200;
      const isScroll = r.event_name === 'cocktail_scroll_depth' && typeof r.value_num === 'number' && r.value_num >= 0 && r.value_num <= 100;
      const isFav = r.event_name === 'cocktail_favorited';

      if (dayAgo < RECENT_DAYS) {
        recent.events += 1;
        if (vid) recent.withVisitor += 1;
        if (hasSrc) recent.withSource += 1;
        if (isDwell) recent.dwell.push(r.value_num as number);
        if (isScroll) recent.scroll.push(r.value_num as number);
        if (isFav) recent.fav += 1;
        perDay[dayAgo].events += 1;
        if (vid) perDay[dayAgo].withVisitor += 1;
        if (hasSrc) perDay[dayAgo].withSource += 1;
      } else if (dayAgo < TREND_PRIOR_DAYS) {
        trendPrior.events += 1;
        if (vid) trendPrior.withVisitor += 1;
        if (hasSrc) trendPrior.withSource += 1;
      }
      // Drift baseline = prior 30 days (overlaps the trend-prior window).
      if (dayAgo >= RECENT_DAYS && dayAgo < DRIFT_BASELINE_DAYS) {
        driftBase.events += 1;
        if (isDwell) driftBase.dwell.push(r.value_num as number);
        if (isScroll) driftBase.scroll.push(r.value_num as number);
        if (isFav) driftBase.fav += 1;
      }
    }

    // --- blocks ---
    const dwellTotal = dwellVals.length + dwellNull + dwellInvalid;
    const dwellStats = stats(dwellVals);
    const dwellBlock: SignalBlock = {
      stats: dwellStats, invalidPct: pct(dwellInvalid, dwellTotal), missingPct: pct(dwellNull, dwellTotal),
      status: dwellTotal === 0 ? 'warning' : dwellInvalid / dwellTotal > 0.05 ? 'fail' : dwellInvalid / dwellTotal > 0.01 ? 'warning' : 'healthy',
    };
    const scrollStats = stats(scrollVals);
    const full100Pct = pct(scroll100, scrollVals.length);
    const scrollBlock = {
      stats: scrollStats, invalidPct: pct(scrollInvalid, scrollTotal), missingPct: pct(scrollNull, scrollTotal),
      full100Pct,
      status: (scrollTotal === 0 ? 'warning' : scrollInvalid > 0 ? 'fail' : full100Pct > 80 ? 'warning' : 'healthy') as HealthStatus,
    };

    const uniqueVisitors = evPerVisitor.size; const uniqueSessions = evPerSession.size;
    const returnVisitors = [...sessPerVisitor.values()].filter((s) => s.size >= 2).length;
    const sessionsPerVisitor = uniqueVisitors > 0 ? Math.round((uniqueSessions / uniqueVisitors) * 100) / 100 : 0;
    const maxEvVisitor = Math.max(0, ...evPerVisitor.values());
    const maxEvSession = Math.max(0, ...evPerSession.values());
    const visitorCoveragePct = pct(withVisitor, rows.length);
    const identityStatus: HealthStatus =
      uniqueVisitors === 0 ? 'warning' : sessionsPerVisitor > 20 || maxEvSession > 400 ? 'fail' : maxEvVisitor > 600 ? 'warning' : 'healthy';

    const favStatus: HealthStatus = favEvents === 0 ? 'warning' : favAdd === 0 ? 'warning' : 'healthy';
    const sourceCov = pct(withSource, rows.length);

    const health: HealthItem[] = [
      { signal: 'Dwell', status: dwellBlock.status, detail: `${dwellStats.count} samples · invalid ${dwellBlock.invalidPct}%` },
      { signal: 'Scroll', status: scrollBlock.status, detail: `${scrollStats.count} samples · 100% rate ${full100Pct}%` },
      { signal: 'Favorites', status: favStatus, detail: `${favEvents} events · add ${pct(favAdd, favEvents)}% / remove ${pct(favRemove, favEvents)}%` },
      { signal: 'Visitor', status: identityStatus, detail: `${uniqueVisitors} visitors · ${sessionsPerVisitor} sess/visitor · coverage ${visitorCoveragePct}%` },
      { signal: 'Source', status: sourceCov >= 90 ? 'healthy' : sourceCov >= 40 ? 'warning' : 'fail', detail: `${sourceCov}% of events tagged` },
      { signal: 'Table', status: tableEvents > 0 ? 'healthy' : 'warning', detail: tableEvents > 0 ? `${tableEvents} table-tagged events` : 'no ?t= scans yet' },
      { signal: 'Revenue', status: orderEvents === 0 ? 'warning' : orderWithRevenue === orderEvents ? 'healthy' : 'warning', detail: orderEvents === 0 ? 'no orders yet' : `${orderWithRevenue}/${orderEvents} orders carry price+cost` },
    ];

    const quality: QualityCheck[] = [
      { name: 'No runaway session', ok: maxEvSession < 400, detail: `max ${maxEvSession} events/session` },
      { name: 'No runaway visitor', ok: maxEvVisitor < 600, detail: `max ${maxEvVisitor} events/visitor` },
      { name: 'Dwell sane', ok: dwellStats.count === 0 || dwellStats.p95 <= 7200, detail: `p95 ${dwellStats.p95}s` },
      { name: 'Scroll 0–100', ok: scrollInvalid === 0, detail: `${scrollInvalid} out-of-range` },
      { name: 'visitor_id persisting', ok: visitorCoveragePct > 0, detail: hasVisitorColumn ? `${visitorCoveragePct}%` : 'column pending 0006' },
    ];

    const collectedSinceDays = Number.isFinite(earliest) ? Math.max(0, Math.round((now - earliest) / DAY_MS)) : null;

    // --- Coverage trends: recent 7d vs prior 7d (doc §14.2) ---
    const covPct = (w: { withVisitor: number; events: number }) => pct(w.withVisitor, w.events);
    const srcPct = (w: { withSource: number; events: number }) => pct(w.withSource, w.events);
    const dir = (r: number, p: number): 'up' | 'down' | 'flat' => (r > p + 5 ? 'up' : r < p - 5 ? 'down' : 'flat');
    const trends = [
      { metric: 'Visitor coverage', recentPct: covPct(recent), priorPct: covPct(trendPrior), trend: dir(covPct(recent), covPct(trendPrior)) },
      { metric: 'Source coverage', recentPct: srcPct(recent), priorPct: srcPct(trendPrior), trend: dir(srcPct(recent), srcPct(trendPrior)) },
    ];

    // --- Drift vs 30-day baseline, 3-tier thresholds (doc §14.3):
    //     <20% Normal(healthy) · 20–50% Warning · >50% Alert(fail). ---
    const deltaPct = (r: number, b: number) => (b > 0 ? Math.round(((r - b) / b) * 1000) / 10 : r > 0 ? 100 : 0);
    const mkDrift = (signal: string, r: number, b: number, enough: boolean) => {
      const d = deltaPct(r, b);
      const abs = Math.abs(d);
      const status: HealthStatus = !enough ? 'healthy' : abs > 50 ? 'fail' : abs >= 20 ? 'warning' : 'healthy';
      return { signal, recent: Math.round(r * 10) / 10, baseline: Math.round(b * 10) / 10, deltaPct: d, status };
    };
    const drift = [
      mkDrift('Dwell P50 (s)', stats(recent.dwell).p50, stats(driftBase.dwell).p50, recent.dwell.length >= 10 && driftBase.dwell.length >= 10),
      mkDrift('Scroll P50 (%)', stats(recent.scroll).p50, stats(driftBase.scroll).p50, recent.scroll.length >= 10 && driftBase.scroll.length >= 10),
      mkDrift('Favorites/day', recent.fav / RECENT_DAYS, driftBase.fav / 30, recent.fav + driftBase.fav >= 20),
      mkDrift('Events/day', recent.events / RECENT_DAYS, driftBase.events / 30, driftBase.events >= 20),
    ];

    // --- Engine Readiness Gate — ALL conditions must hold (doc §14.4) ---
    const rVis = covPct(recent);
    const rSrc = srcPct(recent);
    const CORE = ['Dwell', 'Scroll', 'Favorites', 'Visitor', 'Source'];
    const blockedBy: string[] = [];
    if (rows.length < 500) blockedBy.push(`Only ${rows.length} events (need 500)`);
    if (rVis < 95) blockedBy.push(`Visitor coverage ${rVis}% (need 95)`);
    if (rSrc < 95) blockedBy.push(`Source coverage ${rSrc}% (need 95)`);
    if (dwellStats.count < 50) blockedBy.push(`Dwell samples ${dwellStats.count} (need 50)`);
    if (scrollStats.count < 50) blockedBy.push(`Scroll samples ${scrollStats.count} (need 50)`);
    if (CORE.some((s) => health.find((h) => h.signal === s)?.status !== 'healthy')) blockedBy.push('Core signal not Green');
    if (drift.some((d) => d.status === 'fail')) blockedBy.push('Critical drift (Alert)');

    // Trailing consecutive days (today back) with ≥95% visitor & source coverage + traffic.
    let consecutiveReadyDays = 0;
    for (let day = 0; day < 7; day += 1) {
      const pd = perDay[day];
      if (pd.events > 0 && pct(pd.withVisitor, pd.events) >= 95 && pct(pd.withSource, pd.events) >= 95) consecutiveReadyDays += 1;
      else break;
    }
    if (consecutiveReadyDays < 7) blockedBy.push(`Ready ${consecutiveReadyDays}/7 consecutive days`);
    const readiness = { ready: blockedBy.length === 0, consecutiveReadyDays, requiredDays: 7, blockedBy };

    return {
      totalEvents: rows.length,
      collectedSinceDays,
      hasVisitorColumn,
      readiness,
      trends,
      drift,
      dwell: dwellBlock,
      scrollDepth: scrollBlock,
      favorites: {
        events: favEvents, addEvents: favAdd, removeEvents: favRemove, distinctItems: favItems.size,
        addRatePct: pct(favAdd, favEvents), removeRatePct: pct(favRemove, favEvents), status: favStatus,
      },
      identity: {
        uniqueVisitors, uniqueSessions, totalEvents: rows.length, visitorCoveragePct, returnVisitors,
        sessionsPerVisitor, maxEventsPerVisitor: maxEvVisitor, maxEventsPerSession: maxEvSession,
        avgEventsPerSession: uniqueSessions > 0 ? Math.round((rows.length / uniqueSessions) * 10) / 10 : 0,
        status: identityStatus,
      },
      instrumentationHealth: health,
      quality,
    };
  } catch (e) {
    log.error('analytics', 'getSignalVerification failed', {
      scope: 'getSignalVerification',
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}
