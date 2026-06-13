import 'server-only';
import { createAdminSupabase, type SupabaseServerClient } from '@/lib/supabase/server';
import { getRestaurantId } from '@/lib/supabase/restaurant';

export interface SaleInput {
  slug: string;
  units: number;
  revenue: number;
}

export interface SalesByItem {
  slug: string;
  units: number;
  revenue: number;
}

/** Import a period's POS sales rows. Returns how many rows were inserted. */
export async function importSales(
  restaurantSlug: string,
  periodStart: string,
  periodEnd: string,
  rows: SaleInput[],
  db?: SupabaseServerClient,
): Promise<number> {
  const sb = db ?? createAdminSupabase();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) throw new Error(`Unknown restaurant: ${restaurantSlug}`);
  const payload = rows
    .filter((r) => r.slug && (r.units > 0 || r.revenue > 0))
    .map((r) => ({
      restaurant_id: restId,
      slug: r.slug,
      units: Math.max(0, Math.round(r.units) || 0),
      revenue: Math.max(0, Number(r.revenue) || 0),
      period_start: periodStart,
      period_end: periodEnd,
    }));
  if (payload.length === 0) return 0;
  const { error } = await sb.from('sales').insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}

/** Aggregate all imported sales by slug (units + revenue summed). */
export async function listSalesByItem(restaurantSlug: string, db?: SupabaseServerClient): Promise<SalesByItem[]> {
  const sb = db ?? createAdminSupabase();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) return [];
  const { data, error } = await sb
    .from('sales')
    .select('slug, units, revenue')
    .eq('restaurant_id', restId);
  if (error) throw new Error(error.message);
  const map = new Map<string, SalesByItem>();
  for (const r of data ?? []) {
    const cur = map.get(r.slug) ?? { slug: r.slug, units: 0, revenue: 0 };
    cur.units += Number(r.units) || 0;
    cur.revenue += Number(r.revenue) || 0;
    map.set(r.slug, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}
