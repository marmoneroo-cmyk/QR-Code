import 'server-only';
import { readClient } from '@/lib/supabase/readClient';
import { getRestaurantId } from '@/lib/supabase/restaurant';
import { listSalesByItem } from '@/lib/sales/repository';
import { MENU } from '@/data/cocktail';
import type { ItemSignals, LayoutInsight, MenuSignals, CategoryReach } from '@/lib/opportunities/types';

const EVENT_NAMES = [
  'cocktail_impression',
  'cocktail_opened',
  'cocktail_shared',
  'cocktail_favorited',
  'cocktail_dwell',
  'order_completed',
];

interface EvRow {
  event_name: string | null;
  cocktail_slug: string | null;
  session_id: string | null;
  visitor_id: string | null;
  value_num: number | null;
  metadata: unknown;
}

function addToSet<K>(map: Map<K, Set<string>>, key: K, value: string | null): void {
  if (!value) return;
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

/**
 * Assemble per-item behavioural signals + menu-layout insight from raw events,
 * menu position (MENU order), visitor_id (returning analysis), and the sales table.
 * All counting is by distinct session / visitor — never raw event counts.
 */
export async function getMenuSignals(restaurantSlug = 'diner'): Promise<MenuSignals> {
  const positionBySlug = new Map(MENU.map((c, i) => [c.slug, i]));
  const categoryBySlug = new Map(MENU.map((c) => [c.slug, c.category]));
  const n = MENU.length;

  const sb = await readClient();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) return emptySignals();

  const [{ data, error }, salesList] = await Promise.all([
    sb
      .from('events')
      .select('event_name, cocktail_slug, session_id, visitor_id, value_num, metadata')
      .eq('restaurant_id', restId)
      .in('event_name', EVENT_NAMES)
      .order('created_at', { ascending: false })
      .limit(20000),
    listSalesByItem(restaurantSlug),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EvRow[];
  if (rows.length === 0 && salesList.length === 0) return emptySignals();

  const salesBySlug = new Map(salesList.map((s) => [s.slug, s]));

  // Which visitors are "returning" (seen across >1 distinct session).
  const visitorSessions = new Map<string, Set<string>>();
  for (const r of rows) addToSet(visitorSessions, r.visitor_id ?? '', r.session_id);
  const isReturning = (v: string | null): boolean => !!v && (visitorSessions.get(v)?.size ?? 0) > 1;

  const impr = new Map<string, Set<string>>(); // slug -> sessions
  const opens = new Map<string, Set<string>>();
  const favs = new Map<string, Set<string>>();
  const shares = new Map<string, number>();
  const dwell = new Map<string, { sum: number; count: number }>();
  const openVisitorSessions = new Map<string, Map<string, Set<string>>>(); // slug -> visitor -> sessions
  const committed = new Map<string, Set<string>>(); // slug -> visitors who favorited(add)/ordered
  const sessionMaxPos = new Map<string, number>(); // session -> deepest position seen
  const sessionCategories = new Map<string, Set<string>>(); // session -> categories seen
  const sessions = new Set<string>();

  for (const r of rows) {
    const slug = r.cocktail_slug ?? '';
    const sid = r.session_id;
    const vid = r.visitor_id;
    if (sid) sessions.add(sid);
    const meta = (r.metadata ?? {}) as { action?: string };

    switch (r.event_name) {
      case 'cocktail_impression': {
        addToSet(impr, slug, sid);
        const pos = positionBySlug.get(slug);
        if (sid && pos !== undefined) {
          sessionMaxPos.set(sid, Math.max(sessionMaxPos.get(sid) ?? -1, pos));
          const cat = categoryBySlug.get(slug);
          if (cat) addToSet(sessionCategories, sid, cat);
        }
        break;
      }
      case 'cocktail_opened': {
        addToSet(opens, slug, sid);
        if (vid) {
          let vm = openVisitorSessions.get(slug);
          if (!vm) {
            vm = new Map();
            openVisitorSessions.set(slug, vm);
          }
          addToSet(vm, vid, sid);
        }
        break;
      }
      case 'cocktail_shared':
        shares.set(slug, (shares.get(slug) ?? 0) + 1);
        break;
      case 'cocktail_favorited':
        if (meta.action !== 'remove') {
          addToSet(favs, slug, sid);
          if (vid) addToSet(committed, slug, vid);
        }
        break;
      case 'order_completed':
        if (vid) addToSet(committed, slug, vid);
        break;
      case 'cocktail_dwell': {
        const d = dwell.get(slug) ?? { sum: 0, count: 0 };
        d.sum += Number(r.value_num) || 0;
        d.count += 1;
        dwell.set(slug, d);
        break;
      }
      default:
        break;
    }
  }

  const items: ItemSignals[] = MENU.map((c) => {
    const slug = c.slug;
    const vm = openVisitorSessions.get(slug);
    let returningOpens = 0;
    let repeatNoCommit = 0;
    if (vm) {
      for (const [vid, sess] of vm) {
        if (isReturning(vid)) returningOpens += sess.size;
        if (sess.size >= 2 && !committed.get(slug)?.has(vid)) repeatNoCommit += 1;
      }
    }
    const d = dwell.get(slug);
    const sale = salesBySlug.get(slug);
    return {
      slug,
      position: positionBySlug.get(slug) ?? 0,
      impressions: impr.get(slug)?.size ?? 0,
      opens: opens.get(slug)?.size ?? 0,
      dwellAvgMs: d && d.count > 0 ? Math.round(d.sum / d.count) : 0,
      shares: shares.get(slug) ?? 0,
      favorites: favs.get(slug)?.size ?? 0,
      returningOpens,
      repeatNoCommit,
      salesUnits: sale?.units ?? 0,
      salesRevenue: sale?.revenue ?? 0,
    };
  });

  // Layout insight
  const totalSessions = sessions.size;
  const maxPositions = [...sessionMaxPos.values()];
  const reached = (threshold: number): number =>
    totalSessions > 0 ? Math.round((maxPositions.filter((p) => p >= threshold).length / totalSessions) * 100) : 0;
  const maxImpr = Math.max(0, ...items.map((i) => i.impressions));
  const rarelyReached = items.filter((i) => maxImpr > 0 && i.impressions <= maxImpr * 0.2).map((i) => i.slug);

  const catSessions = new Map<string, Set<string>>();
  for (const [sid, cats] of sessionCategories) for (const cat of cats) addToSet(catSessions, cat, sid);
  const categoryReach: CategoryReach[] = [...new Set(MENU.map((c) => c.category))].map((cat) => ({
    category: cat,
    reachPct: totalSessions > 0 ? Math.round(((catSessions.get(cat)?.size ?? 0) / totalSessions) * 100) : 0,
  }));

  const layout: LayoutInsight = {
    sessions: totalSessions,
    reachedFirst3Pct: reached(2),
    reachedHalfPct: reached(Math.floor((n - 1) / 2)),
    reachedAllPct: reached(n - 1),
    rarelyReached,
    categoryReach,
  };

  return { items, layout, hasData: rows.length > 0 };
}

function emptySignals(): MenuSignals {
  return {
    items: [],
    layout: { sessions: 0, reachedFirst3Pct: 0, reachedHalfPct: 0, reachedAllPct: 0, rarelyReached: [], categoryReach: [] },
    hasData: false,
  };
}
