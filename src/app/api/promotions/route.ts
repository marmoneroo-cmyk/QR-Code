import { NextResponse, type NextRequest } from 'next/server';
import {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  type PromotionInput,
} from '@/lib/promotions/repository';
import { logChange } from '@/lib/changes/repository';
import { requireSession, unauthorized, apiError } from '@/lib/auth/guard';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DISCOUNT_TYPES = ['percentage', 'fixed'];
const SCOPES = ['item', 'category', 'all'];
// Keep in sync with the BadgeKind union in '@/lib/experience/types'.
const BADGE_KINDS = [
  'signature',
  'guest_favorite',
  'trending',
  'happy_hour',
  'discount',
  'seasonal',
  'limited_time',
  'new_item',
  'custom',
];

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Public reads are cached at the CDN edge; writes stay uncached (session-scoped).
const PUBLIC_GET_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } as const;

// Per-field checks shared by POST's validateInput (all required) and PATCH
// (only the fields actually present in the body are checked).
function checkName(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return 'name is required';
  return undefined;
}
function checkType(value: unknown): string | undefined {
  if (!DISCOUNT_TYPES.includes(value as string)) return 'type must be percentage|fixed';
  return undefined;
}
function checkValue(value: unknown): string | undefined {
  if (typeof value !== 'number' || value < 0) return 'value must be a positive number';
  return undefined;
}
function checkScope(value: unknown): string | undefined {
  if (!SCOPES.includes(value as string)) return 'scope must be item|category|all';
  return undefined;
}
function checkActive(value: unknown): string | undefined {
  if (typeof value !== 'boolean') return 'active must be a boolean';
  return undefined;
}
function checkTargetSlugs(value: unknown): string | undefined {
  if (!Array.isArray(value) || !value.every((s) => typeof s === 'string')) {
    return 'targetSlugs must be an array of strings';
  }
  return undefined;
}
function checkBadgeKind(value: unknown): string | undefined {
  if (!BADGE_KINDS.includes(value as string)) return 'badgeKind is invalid';
  return undefined;
}

// PUBLIC read: the diner menu (useMenuConfig) fetches its restaurant's active promotions.
// `promotions` is public-read by RLS (badges are shown to anonymous guests), so the
// ?restaurant= param here exposes only already-public data — it is NOT a tenant breach.
// The WRITE handlers below are the real boundary and derive the tenant from the session.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const restaurant = req.nextUrl.searchParams.get('restaurant') ?? 'diner';
    const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true';
    const data = await listPromotions(restaurant, { activeOnly });
    return NextResponse.json({ success: true, data }, { headers: PUBLIC_GET_HEADERS });
  } catch (error: unknown) {
    return apiError(error);
  }
}

function validateInput(body: Record<string, unknown>): PromotionInput | string {
  const nameErr = checkName(body.name);
  if (nameErr) return nameErr;
  const typeErr = checkType(body.type);
  if (typeErr) return typeErr;
  const valueErr = checkValue(body.value);
  if (valueErr) return valueErr;
  const scopeErr = checkScope(body.scope);
  if (scopeErr) return scopeErr;
  if (body.active !== undefined) {
    const activeErr = checkActive(body.active);
    if (activeErr) return activeErr;
  }
  if (body.targetSlugs !== undefined) {
    const targetSlugsErr = checkTargetSlugs(body.targetSlugs);
    if (targetSlugsErr) return targetSlugsErr;
  }
  if (body.badgeKind !== undefined) {
    const badgeKindErr = checkBadgeKind(body.badgeKind);
    if (badgeKindErr) return badgeKindErr;
  }
  return {
    name: (body.name as string).trim(),
    type: body.type as PromotionInput['type'],
    value: body.value as number,
    scope: body.scope as PromotionInput['scope'],
    targetSlugs: Array.isArray(body.targetSlugs) ? (body.targetSlugs as string[]) : undefined,
    targetCategories: Array.isArray(body.targetCategories) ? (body.targetCategories as string[]) : undefined,
    schedule: (body.schedule as PromotionInput['schedule']) ?? undefined,
    badgeKind: (body.badgeKind as PromotionInput['badgeKind']) ?? undefined,
    badgeLabel: (body.badgeLabel as PromotionInput['badgeLabel']) ?? undefined,
    active: typeof body.active === 'boolean' ? body.active : undefined,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const body = (await req.json()) as Record<string, unknown>;
    const input = validateInput(body);
    if (typeof input === 'string') return err(input);
    const data = await createPromotion(session.restaurantSlug, input, db);
    const single = data.scope === 'item' && data.targetSlugs?.length === 1 ? data.targetSlugs[0] : null;
    await logChange(
      session.restaurantSlug,
      {
        changeType: 'promotion_created',
        entityType: single ? 'cocktail' : 'menu',
        entityId: single,
        after: { name: data.name, type: data.type, value: data.value, scope: data.scope },
        summary: `Promotion: ${data.name} (−${data.value}${data.type === 'percentage' ? '%' : '₪'})`,
      },
      db,
    );
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.id !== 'string') return err('id is required');
    const { id, restaurant: _ignoredTenant, ...patch } = body;
    // Only fields actually present in the PATCH body are checked, using the
    // same per-field validators POST's validateInput() applies.
    if (patch.type !== undefined) {
      const typeErr = checkType(patch.type);
      if (typeErr) return err(typeErr);
    }
    if (patch.value !== undefined) {
      const valueErr = checkValue(patch.value);
      if (valueErr) return err(valueErr);
    }
    if (patch.scope !== undefined) {
      const scopeErr = checkScope(patch.scope);
      if (scopeErr) return err(scopeErr);
    }
    if (patch.active !== undefined) {
      const activeErr = checkActive(patch.active);
      if (activeErr) return err(activeErr);
    }
    if (patch.targetSlugs !== undefined) {
      const targetSlugsErr = checkTargetSlugs(patch.targetSlugs);
      if (targetSlugsErr) return err(targetSlugsErr);
    }
    if (patch.badgeKind !== undefined) {
      const badgeKindErr = checkBadgeKind(patch.badgeKind);
      if (badgeKindErr) return err(badgeKindErr);
    }
    const data = await updatePromotion(session.restaurantSlug, id, patch as Partial<PromotionInput>, db);
    const single = data.scope === 'item' && data.targetSlugs?.length === 1 ? data.targetSlugs[0] : null;
    await logChange(
      session.restaurantSlug,
      {
        changeType: 'active' in patch ? 'promotion_activated' : 'promotion_edited',
        entityType: single ? 'cocktail' : 'menu',
        entityId: single,
        after: { name: data.name },
        summary: `Promotion updated: ${data.name}`,
      },
      db,
    );
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return err('id is required');
    await deletePromotion(session.restaurantSlug, id, db);
    await logChange(
      session.restaurantSlug,
      {
        changeType: 'promotion_deleted',
        entityType: 'promotion',
        entityId: id,
        summary: 'Promotion deleted',
      },
      db,
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
