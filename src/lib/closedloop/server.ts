import 'server-only';
import { readClient } from '@/lib/supabase/readClient';
import { getRestaurantId } from '@/lib/supabase/restaurant';
import { listChanges, type ChangeRecord } from '@/lib/changes/repository';
import { MENU } from '@/data/cocktail';
import { measureImpact } from './measure';
import type { MetricKey, ImpactResult, ImpactStatus, Confidence } from './types';

const WINDOW_DAYS = 7;
const DAY_MS = 86400000;

const METRIC_EVENTS: Record<MetricKey, string[]> = {
  views: ['cocktail_impression'],
  opens: ['cocktail_opened'],
  favorites: ['cocktail_favorited'],
  intent: ['cocktail_favorited', 'order_completed'],
  sales: ['order_completed'],
  shares: ['cocktail_shared'],
};

/** Which metric a change is expected to move. */
function metricFor(changeType: string): MetricKey {
  if (changeType.startsWith('promotion')) return 'intent';
  if (changeType.startsWith('experience')) return 'opens';
  return 'opens'; // external / position / default
}

function confidenceOf(status: ImpactStatus, sample: number, daysSince: number): Confidence {
  if (status === 'too_early' || status === 'insufficient_data') return 'low';
  if (sample >= 24 && daysSince >= WINDOW_DAYS) return 'high';
  if (sample >= 8 && daysSince >= 3) return 'medium';
  return 'low';
}

export interface ClosedLoopItem {
  change: ChangeRecord;
  metric: MetricKey;
  observationDays: number;
  stillAccumulating: boolean;
  confidence: Confidence;
  result: ImpactResult;
}

export interface ClosedLoopReport {
  measured: ClosedLoopItem[];
  timeline: ChangeRecord[];
  hasData: boolean;
}

interface EvRow {
  event_name: string | null;
  cocktail_slug: string | null;
  session_id: string | null;
  created_at: string;
  metadata: unknown;
}

/**
 * Closed Loop: for each in-app change tied to a cocktail, compare the watched
 * metric (distinct sessions) before vs after the change. v1 is deliberately
 * simple — Before → Action → After + Confidence. No multi-factor attribution.
 */
export async function getClosedLoop(restaurantSlug = 'diner'): Promise<ClosedLoopReport> {
  const knownSlugs = new Set(MENU.map((c) => c.slug));
  const changes = await listChanges(restaurantSlug);
  const measurable = changes.filter((c) => c.entityType === 'cocktail' && c.entityId && knownSlugs.has(c.entityId));
  if (measurable.length === 0) {
    return { measured: [], timeline: changes, hasData: changes.length > 0 };
  }

  const sb = await readClient();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) return { measured: [], timeline: changes, hasData: changes.length > 0 };

  const slugs = [...new Set(measurable.map((c) => c.entityId as string))];
  const eventNames = [...new Set(measurable.flatMap((c) => METRIC_EVENTS[metricFor(c.changeType)]))];
  const { data, error } = await sb
    .from('events')
    .select('event_name, cocktail_slug, session_id, created_at, metadata')
    .eq('restaurant_id', restId)
    .in('cocktail_slug', slugs)
    .in('event_name', eventNames)
    .order('created_at', { ascending: false })
    .limit(20000);
  if (error) throw new Error(error.message);
  const events = (data ?? []) as EvRow[];

  const now = Date.now();
  const winMs = WINDOW_DAYS * DAY_MS;

  const measured: ClosedLoopItem[] = measurable.map((c) => {
    const metric = metricFor(c.changeType);
    const names = new Set(METRIC_EVENTS[metric]);
    const appliedAt = new Date(c.createdAt).getTime();
    const daysSince = Math.max(0, Math.floor((now - appliedAt) / DAY_MS));

    const beforeSessions = new Set<string>();
    const afterSessions = new Set<string>();
    for (const e of events) {
      if (e.cocktail_slug !== c.entityId || !e.event_name || !names.has(e.event_name)) continue;
      if (e.event_name === 'cocktail_favorited') {
        const m = (e.metadata ?? {}) as { action?: string };
        if (m.action === 'remove') continue;
      }
      const t = new Date(e.created_at).getTime();
      const sid = e.session_id ?? String(t);
      if (t >= appliedAt - winMs && t < appliedAt) beforeSessions.add(sid);
      else if (t >= appliedAt && t <= appliedAt + winMs) afterSessions.add(sid);
    }

    const before = beforeSessions.size;
    const after = afterSessions.size;
    const result = measureImpact({ before, after, daysSince }, { windowDays: WINDOW_DAYS });
    return {
      change: c,
      metric,
      observationDays: Math.min(daysSince, WINDOW_DAYS),
      stillAccumulating: daysSince < WINDOW_DAYS,
      confidence: confidenceOf(result.status, before + after, daysSince),
      result,
    };
  });

  return { measured, timeline: changes, hasData: true };
}
