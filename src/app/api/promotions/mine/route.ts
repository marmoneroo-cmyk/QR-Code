import { NextResponse, type NextRequest } from 'next/server';
import { listPromotions } from '@/lib/promotions/repository';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Guarded, session-scoped promotions read for ADMIN surfaces. The tenant comes from the
 * verified session (never `?restaurant=`), so it stays correct once there's more than one
 * tenant. The public `/api/promotions?restaurant=` GET is unchanged — it serves the
 * anonymous diner menu and must not pay an auth round-trip.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true';
    const data = await listPromotions(session.restaurantSlug, { activeOnly });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
