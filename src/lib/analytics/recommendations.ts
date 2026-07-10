import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { log } from '@/lib/log';
import type { CoViewRow, Recommendations, RelatedItem } from './recommendations-types';

const TENANT_SLUG = 'diner';
/** How many co-viewed neighbours to surface per cocktail. */
const MAX_RELATED = 4;

function emptyRecommendations(): Recommendations {
  return { rows: [], hasData: false };
}

/** Stable key for an unordered pair of slugs. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Co-view recommendations: "guests who viewed X also viewed Y".
 *
 * Reads `cocktail_opened` events, groups the distinct slugs opened within each
 * `session_id`, then counts every unordered pair of slugs co-opened in the same
 * session. Per cocktail we report its distinct-session view count and its top
 * co-viewed neighbours (by shared-session count, desc). Server-only (uses the
 * service-role client). Returns empty if Supabase isn't configured or the
 * tenant is missing — analytics never breaks the page.
 */
export async function getCoViews(
  restaurantSlug: string = TENANT_SLUG,
): Promise<Recommendations> {
  try {
    const supabase = createAdminSupabase();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return emptyRecommendations();

    const { data, error } = await supabase
      .from('events')
      .select('event_name, cocktail_slug, session_id')
      .eq('restaurant_id', restaurant.id)
      .eq('event_name', 'cocktail_opened')
      .order('created_at', { ascending: false })
      .limit(50000);
    if (error || !data || data.length === 0) return emptyRecommendations();

    // session_id -> set of distinct cocktail slugs opened in that session.
    const sessionSlugs = new Map<string, Set<string>>();
    for (const e of data) {
      if (!e.session_id || !e.cocktail_slug) continue;
      let set = sessionSlugs.get(e.session_id);
      if (!set) {
        set = new Set<string>();
        sessionSlugs.set(e.session_id, set);
      }
      set.add(e.cocktail_slug);
    }

    // Distinct-session views per slug + co-view counts per unordered pair.
    const viewsBySlug = new Map<string, number>();
    const pairCounts = new Map<string, number>();
    for (const set of sessionSlugs.values()) {
      const slugs = [...set];
      for (const slug of slugs) {
        viewsBySlug.set(slug, (viewsBySlug.get(slug) ?? 0) + 1);
      }
      for (let i = 0; i < slugs.length; i += 1) {
        for (let j = i + 1; j < slugs.length; j += 1) {
          const key = pairKey(slugs[i], slugs[j]);
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }

    // slug -> its co-viewed neighbours with shared-session counts.
    const relatedBySlug = new Map<string, RelatedItem[]>();
    const addRelated = (slug: string, other: string, coViews: number) => {
      const list = relatedBySlug.get(slug) ?? [];
      list.push({ slug: other, coViews });
      relatedBySlug.set(slug, list);
    };
    for (const [key, coViews] of pairCounts) {
      const [a, b] = key.split('|');
      addRelated(a, b, coViews);
      addRelated(b, a, coViews);
    }

    const rows: CoViewRow[] = [...viewsBySlug.entries()]
      .map(([slug, views]) => ({
        slug,
        views,
        related: (relatedBySlug.get(slug) ?? [])
          .sort((x, y) => y.coViews - x.coViews || x.slug.localeCompare(y.slug))
          .slice(0, MAX_RELATED),
      }))
      .sort((x, y) => y.views - x.views || x.slug.localeCompare(y.slug));

    return { rows, hasData: pairCounts.size > 0 };
  } catch (e) {
    log.error('analytics', 'getCoViews failed', {
      scope: 'getCoViews',
      error: e instanceof Error ? e.message : String(e),
    });
    return emptyRecommendations();
  }
}
