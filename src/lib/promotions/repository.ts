import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { getRestaurantId } from '@/lib/supabase/restaurant';
import type { Json } from '@/lib/supabase/types';
import type { Promotion, DiscountType, PromotionScope } from './types';
import type { Schedule } from '../scheduling/types';
import type { BadgeKind, BadgeLabel } from '../experience/types';

interface PromotionRow {
  id: string;
  name: string;
  type: DiscountType;
  value: number | string;
  scope: PromotionScope;
  target_slugs: unknown;
  target_categories: unknown;
  schedule: unknown;
  badge_kind: string | null;
  badge_label: unknown;
  active: boolean;
}

function rowToPromotion(r: PromotionRow): Promotion {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    value: Number(r.value),
    scope: r.scope,
    targetSlugs: (r.target_slugs as string[] | null) ?? undefined,
    targetCategories: (r.target_categories as string[] | null) ?? undefined,
    schedule: (r.schedule as Schedule | null) ?? undefined,
    badgeKind: (r.badge_kind as BadgeKind | null) ?? undefined,
    badgeLabel: (r.badge_label as BadgeLabel | null) ?? undefined,
  };
}

export interface PromotionInput {
  name: string;
  type: DiscountType;
  value: number;
  scope: PromotionScope;
  targetSlugs?: string[];
  targetCategories?: string[];
  schedule?: Schedule;
  badgeKind?: BadgeKind;
  badgeLabel?: BadgeLabel;
  active?: boolean;
}

export async function listPromotions(
  restaurantSlug: string,
  opts: { activeOnly?: boolean } = {},
): Promise<Promotion[]> {
  const sb = await createAdminSupabase();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) return [];
  let query = sb
    .from('promotions')
    .select('*')
    .eq('restaurant_id', restId)
    .order('created_at', { ascending: false });
  if (opts.activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => rowToPromotion(d as unknown as PromotionRow));
}

export async function createPromotion(restaurantSlug: string, input: PromotionInput): Promise<Promotion> {
  const sb = await createAdminSupabase();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) throw new Error(`Unknown restaurant: ${restaurantSlug}`);
  const { data, error } = await sb
    .from('promotions')
    .insert({
      restaurant_id: restId,
      name: input.name,
      type: input.type,
      value: input.value,
      scope: input.scope,
      target_slugs: (input.targetSlugs ?? null) as unknown as Json,
      target_categories: (input.targetCategories ?? null) as unknown as Json,
      schedule: (input.schedule ?? null) as unknown as Json,
      badge_kind: input.badgeKind ?? null,
      badge_label: (input.badgeLabel ?? null) as unknown as Json,
      active: input.active ?? true,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToPromotion(data as unknown as PromotionRow);
}

export async function updatePromotion(
  restaurantSlug: string,
  id: string,
  patch: Partial<PromotionInput>,
): Promise<Promotion> {
  const sb = await createAdminSupabase();
  // Tenant scope: a promotion can only be edited by the restaurant that owns it —
  // guessing another tenant's promotion id must not allow a cross-tenant write.
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) throw new Error(`Unknown restaurant: ${restaurantSlug}`);
  const upd: Record<string, unknown> = {};
  if (patch.name !== undefined) upd.name = patch.name;
  if (patch.type !== undefined) upd.type = patch.type;
  if (patch.value !== undefined) upd.value = patch.value;
  if (patch.scope !== undefined) upd.scope = patch.scope;
  if (patch.targetSlugs !== undefined) upd.target_slugs = patch.targetSlugs;
  if (patch.targetCategories !== undefined) upd.target_categories = patch.targetCategories;
  if (patch.schedule !== undefined) upd.schedule = patch.schedule;
  if (patch.badgeKind !== undefined) upd.badge_kind = patch.badgeKind;
  if (patch.badgeLabel !== undefined) upd.badge_label = patch.badgeLabel;
  if (patch.active !== undefined) upd.active = patch.active;
  const { data, error } = await sb
    .from('promotions')
    .update(upd as never)
    .eq('id', id)
    .eq('restaurant_id', restId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToPromotion(data as unknown as PromotionRow);
}

export async function deletePromotion(restaurantSlug: string, id: string): Promise<void> {
  const sb = await createAdminSupabase();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) throw new Error(`Unknown restaurant: ${restaurantSlug}`);
  const { error } = await sb
    .from('promotions')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restId);
  if (error) throw new Error(error.message);
}
