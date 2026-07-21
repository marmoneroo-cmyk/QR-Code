import { NextResponse, type NextRequest } from 'next/server';
import {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  type PromotionInput,
} from '@/lib/promotions/repository';
import { logChange } from '@/lib/changes/repository';
import {
  validateInput,
  checkType,
  checkValue,
  checkScope,
  checkActive,
  checkTargetSlugs,
  checkTargetCategories,
  checkSchedule,
  checkBadgeKind,
} from '@/lib/promotions/validate';
import { requireSession, unauthorized, apiError } from '@/lib/auth/guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { readJsonCapped } from '@/lib/net/bounded';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 256_000;

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Owner-editable config: NOT edge-cached. The old s-maxage=60 meant that after an
// owner toggled a promotion, guests (and the owner checking the menu) kept seeing the
// PRE-change response for up to 60s + 300s stale — so activating Happy Hour looked
// like it did nothing until the cache expired. The query is tiny and indexed, so a
// live read per menu load is the right trade for changes that must feel immediate.
const PUBLIC_GET_HEADERS = { 'Cache-Control': 'no-store' } as const;

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const parsed = await readJsonCapped<Record<string, unknown>>(req, MAX_BODY);
    if (!parsed.ok) {
      return parsed.reason === 'too_large' ? err('payload too large', 413) : err('invalid json');
    }
    const body = parsed.data;
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
        // Language-neutral: the owner's promo name + the discount (digits/%, no words).
        // The action ("added") is carried by changeType and localized at render time,
        // so this reads correctly in either language on the owner-facing timeline.
        summary: `${data.name} · −${data.value}${data.type === 'percentage' ? '%' : '₪'}`,
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
    const parsed = await readJsonCapped<Record<string, unknown>>(req, MAX_BODY);
    if (!parsed.ok) {
      return parsed.reason === 'too_large' ? err('payload too large', 413) : err('invalid json');
    }
    const body = parsed.data;
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
    if (patch.targetCategories !== undefined) {
      const targetCategoriesErr = checkTargetCategories(patch.targetCategories);
      if (targetCategoriesErr) return err(targetCategoriesErr);
    }
    if (patch.badgeKind !== undefined) {
      const badgeKindErr = checkBadgeKind(patch.badgeKind);
      if (badgeKindErr) return err(badgeKindErr);
    }
    if (patch.schedule !== undefined && patch.schedule !== null) {
      const scheduleErr = checkSchedule(patch.schedule);
      if (scheduleErr) return err(scheduleErr);
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
        // Just the name — the "updated" verb is the changeType, localized at render.
        summary: data.name,
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
        // No name available at delete time; changeType carries the "removed" meaning,
        // localized at render. (English "Promotion deleted" was owner-facing jargon.)
        summary: undefined,
      },
      db,
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
