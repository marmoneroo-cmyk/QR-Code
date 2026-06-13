import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export type Role = 'owner' | 'manager' | 'staff';

export interface SessionContext {
  userId: string;
  email: string | null;
  restaurantId: string;
  restaurantSlug: string;
  role: Role;
}

/**
 * The authenticated tenant context — who the request is, which restaurant they
 * belong to, and their role. Read from the verified Supabase session (cookie),
 * then the restaurant_members + restaurants tables under RLS (a user can only
 * see their own membership; restaurants are public-read).
 *
 * Returns null when there is no valid session or the user is not a member of any
 * restaurant. This is the single source of tenant truth for authenticated routes
 * — never trust a tenant supplied in the URL or request body.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const sb = await createServerSupabase();

  // getUser() validates the JWT against Supabase (not just decodes the cookie).
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: member } = await sb
    .from('restaurant_members')
    .select('restaurant_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return null;

  const { data: restaurant } = await sb
    .from('restaurants')
    .select('slug')
    .eq('id', member.restaurant_id)
    .maybeSingle();
  // A member whose restaurant row is unreadable is NOT a usable tenant context —
  // fail closed (401) rather than returning an empty slug that silently resolves
  // every downstream query to "unknown restaurant" / empty data.
  if (!restaurant) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    restaurantId: member.restaurant_id,
    restaurantSlug: restaurant.slug,
    role: member.role as Role,
  };
}

/** True when the session's role is at or above `min` (owner > manager > staff). */
export function roleAtLeast(role: Role, min: Role): boolean {
  const rank: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };
  return rank[role] >= rank[min];
}
