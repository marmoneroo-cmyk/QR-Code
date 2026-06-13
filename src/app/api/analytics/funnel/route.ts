import { NextResponse } from 'next/server';
import { getCocktailFunnels } from '@/lib/analytics/queries';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NOTE (Phase 2): gate this behind restaurant-member auth once login is wired.
// For now it returns aggregate, non-PII funnel counts for the single 'diner' tenant.
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const data = await getCocktailFunnels(session.restaurantSlug);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
