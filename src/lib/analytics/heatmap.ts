import 'server-only';
import { readClient } from '@/lib/supabase/readClient';
import { getRestaurantId } from '@/lib/supabase/restaurant';
import { fetchAllEvents } from './fetchEvents';

export interface HeatmapSection {
  section: string;
  /** Number of section_attention events (real attention, ≥0.8s visible). */
  views: number;
  avgDwellMs: number;
}

export interface AttentionHeatmap {
  sections: HeatmapSection[];
  hasData: boolean;
}

/**
 * Aggregates `section_attention` events into a per-section attention map —
 * "which part of the page drew the eye" (ingredients / flavor / story / …).
 * Data an owner cannot get any other way.
 */
export async function getAttentionHeatmap(restaurantSlug = 'diner'): Promise<AttentionHeatmap> {
  const sb = await readClient();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) return { sections: [], hasData: false };

  // Paginated: past 1000 section_attention events the read was capped, so a busy
  // restaurant's heatmap would drift toward only its most-recent attention.
  const data = await fetchAllEvents<{ metadata: Record<string, unknown> | null; value_num: number | null }>(
    sb,
    restId,
    'metadata, value_num',
    { eventNames: ['section_attention'] },
  );

  const agg = new Map<string, { count: number; totalDwell: number }>();
  for (const row of data) {
    const md = (row.metadata ?? {}) as { section?: string; dwellMs?: number };
    if (!md.section) continue;
    const dwell = Number(md.dwellMs ?? row.value_num ?? 0) || 0;
    const cur = agg.get(md.section) ?? { count: 0, totalDwell: 0 };
    cur.count += 1;
    cur.totalDwell += dwell;
    agg.set(md.section, cur);
  }

  const sections: HeatmapSection[] = [...agg.entries()]
    .map(([section, v]) => ({ section, views: v.count, avgDwellMs: Math.round(v.totalDwell / v.count) }))
    .sort((a, b) => b.views - a.views);

  return { sections, hasData: sections.length > 0 };
}
