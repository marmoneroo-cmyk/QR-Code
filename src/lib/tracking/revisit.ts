'use client';

import { track } from './track';

const KEY = 'cocktail-demo:last-view';

/**
 * Records a per-dish view timestamp and, on a RETURN visit, emits the raw
 * `cocktail_revisited` signal with the gap since the previous view.
 *
 * Why raw (not derived): the gap itself is information — "reopened after 20 min"
 * vs "reopened after a week" are very different intents, and reconstructing that
 * from a lossy event timeline would lose it. We store the observation, never a
 * conclusion (H-A). Best-effort: never throws.
 */
export function recordView(slug: string): void {
  if (typeof window === 'undefined' || !slug) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const prev = map[slug];
    const now = Date.now();
    if (typeof prev === 'number' && prev > 0 && now > prev) {
      const minutes = Math.round((now - prev) / 60000);
      track({
        event: 'cocktail_revisited',
        cocktailSlug: slug,
        value: minutes,
        metadata: { previousViewTs: prev, minutesSinceLastView: minutes },
      });
    }
    map[slug] = now;
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* analytics must never throw */
  }
}
