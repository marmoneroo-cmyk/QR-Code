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

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
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
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return apiError(error);
  }
}

function validateInput(body: Record<string, unknown>): PromotionInput | string {
  if (typeof body.name !== 'string' || !body.name.trim()) return 'name is required';
  if (!DISCOUNT_TYPES.includes(body.type as string)) return 'type must be percentage|fixed';
  if (typeof body.value !== 'number' || body.value < 0) return 'value must be a positive number';
  if (!SCOPES.includes(body.scope as string)) return 'scope must be item|category|all';
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
