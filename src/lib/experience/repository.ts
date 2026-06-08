import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { getRestaurantId } from '@/lib/supabase/restaurant';
import type { Json } from '@/lib/supabase/types';
import type { ExperienceConfig } from './types';

/** All per-slug experience configs for a restaurant, keyed by slug. */
export async function listExperience(restaurantSlug: string): Promise<Record<string, ExperienceConfig>> {
  const sb = await createAdminSupabase();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) return {};
  const { data, error } = await sb
    .from('menu_experience')
    .select('slug, config')
    .eq('restaurant_id', restId);
  if (error) throw new Error(error.message);
  const out: Record<string, ExperienceConfig> = {};
  for (const row of data ?? []) {
    out[row.slug as string] = ((row.config as ExperienceConfig | null) ?? {}) as ExperienceConfig;
  }
  return out;
}

export async function upsertExperience(
  restaurantSlug: string,
  slug: string,
  config: ExperienceConfig,
): Promise<void> {
  const sb = await createAdminSupabase();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) throw new Error(`Unknown restaurant: ${restaurantSlug}`);
  const { error } = await sb
    .from('menu_experience')
    .upsert(
      { restaurant_id: restId, slug, config: config as unknown as Json },
      { onConflict: 'restaurant_id,slug' },
    );
  if (error) throw new Error(error.message);
}
