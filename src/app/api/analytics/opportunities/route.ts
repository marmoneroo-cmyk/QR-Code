import { NextResponse } from 'next/server';
import { getMenuSignals } from '@/lib/analytics/menu-signals';
import { buildOpportunities } from '@/lib/opportunities/build';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const signals = await getMenuSignals(session.restaurantSlug);
    const opportunities = buildOpportunities(signals);
    return NextResponse.json({ success: true, data: { opportunities, layout: signals.layout } });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
