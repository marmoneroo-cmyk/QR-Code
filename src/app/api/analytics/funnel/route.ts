import { NextResponse } from 'next/server';
import { getCocktailFunnels } from '@/lib/analytics/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NOTE (Phase 2): gate this behind restaurant-member auth once login is wired.
// For now it returns aggregate, non-PII funnel counts for the single 'diner' tenant.
export async function GET(): Promise<NextResponse> {
  try {
    const data = await getCocktailFunnels();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
