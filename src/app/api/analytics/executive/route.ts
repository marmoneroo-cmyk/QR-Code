import { NextResponse } from 'next/server';
import { getExecutiveSummary } from '@/lib/analytics/insights';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const data = await getExecutiveSummary(session.restaurantSlug);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
