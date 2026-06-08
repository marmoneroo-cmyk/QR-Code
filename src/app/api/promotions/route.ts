import { NextResponse, type NextRequest } from 'next/server';
import {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  type PromotionInput,
} from '@/lib/promotions/repository';
import { logChange } from '@/lib/changes/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DISCOUNT_TYPES = ['percentage', 'fixed'];
const SCOPES = ['item', 'category', 'all'];

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// NOTE (Phase 2): gate writes behind restaurant-member auth once login is wired.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const restaurant = req.nextUrl.searchParams.get('restaurant') ?? 'diner';
    const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true';
    const data = await listPromotions(restaurant, { activeOnly });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
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
    const body = (await req.json()) as Record<string, unknown>;
    const restaurant = (body.restaurant as string) ?? 'diner';
    const input = validateInput(body);
    if (typeof input === 'string') return err(input);
    const data = await createPromotion(restaurant, input);
    const single = data.scope === 'item' && data.targetSlugs?.length === 1 ? data.targetSlugs[0] : null;
    await logChange(restaurant, {
      changeType: 'promotion_created',
      entityType: single ? 'cocktail' : 'menu',
      entityId: single,
      after: { name: data.name, type: data.type, value: data.value, scope: data.scope },
      summary: `Promotion: ${data.name} (−${data.value}${data.type === 'percentage' ? '%' : '₪'})`,
    });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.id !== 'string') return err('id is required');
    const { id, restaurant: r, ...patch } = body;
    const restaurant = typeof r === 'string' ? r : 'diner';
    const data = await updatePromotion(id, patch as Partial<PromotionInput>);
    const single = data.scope === 'item' && data.targetSlugs?.length === 1 ? data.targetSlugs[0] : null;
    await logChange(restaurant, {
      changeType: 'active' in patch ? 'promotion_activated' : 'promotion_edited',
      entityType: single ? 'cocktail' : 'menu',
      entityId: single,
      after: { name: data.name },
      summary: `Promotion updated: ${data.name}`,
    });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return err('id is required');
    await deletePromotion(id);
    await logChange('diner', {
      changeType: 'promotion_deleted',
      entityType: 'promotion',
      entityId: id,
      summary: 'Promotion deleted',
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}
