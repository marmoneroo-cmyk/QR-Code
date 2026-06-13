import 'server-only';
import { createAdminSupabase, type SupabaseServerClient } from '@/lib/supabase/server';
import { getRestaurantId } from '@/lib/supabase/restaurant';
import type { Json } from '@/lib/supabase/types';

export type EntityType = 'cocktail' | 'promotion' | 'menu' | 'external';

export interface ChangeInput {
  changeType: string;
  entityType: EntityType;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  summary?: string;
  source?: 'auto' | 'manual';
  /** ISO timestamp — for manual external actions dated in the past. */
  createdAt?: string;
}

export interface ChangeRecord {
  id: string;
  changeType: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  source: 'auto' | 'manual';
  createdAt: string;
}

/**
 * Record a change on the generic timeline.
 * Best-effort: never throws — an audit-log failure must not break the main action.
 */
export async function logChange(restaurantSlug: string, input: ChangeInput, db?: SupabaseServerClient): Promise<void> {
  try {
    const sb = db ?? createAdminSupabase();
    const restId = await getRestaurantId(restaurantSlug);
    if (!restId) return;
    await sb.from('changes').insert({
      restaurant_id: restId,
      change_type: input.changeType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      before: (input.before ?? null) as unknown as Json,
      after: (input.after ?? null) as unknown as Json,
      summary: input.summary ?? null,
      source: input.source ?? 'auto',
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    });
  } catch {
    // swallow — audit logging is best-effort and must never break the action
  }
}

export async function listChanges(restaurantSlug: string, limit = 200, db?: SupabaseServerClient): Promise<ChangeRecord[]> {
  const sb = db ?? createAdminSupabase();
  const restId = await getRestaurantId(restaurantSlug);
  if (!restId) return [];
  const { data, error } = await sb
    .from('changes')
    .select('*')
    .eq('restaurant_id', restId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    changeType: r.change_type,
    entityType: r.entity_type,
    entityId: r.entity_id,
    summary: r.summary,
    source: r.source,
    createdAt: r.created_at,
  }));
}
