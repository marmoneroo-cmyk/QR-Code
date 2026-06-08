import 'server-only';
import { createAdminSupabase } from './server';

const cache = new Map<string, string>();

/** Resolve a restaurant UUID from its stable slug (cached per process). */
export async function getRestaurantId(slug: string): Promise<string | null> {
  const cached = cache.get(slug);
  if (cached) return cached;
  const sb = await createAdminSupabase();
  const { data, error } = await sb.from('restaurants').select('id').eq('slug', slug).maybeSingle();
  if (error || !data) return null;
  cache.set(slug, data.id);
  return data.id;
}
