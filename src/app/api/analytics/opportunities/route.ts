import { NextResponse } from 'next/server';
import { getMenuSignals } from '@/lib/analytics/menu-signals';
import { buildOpportunities } from '@/lib/opportunities/build';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const signals = await getMenuSignals();
    const opportunities = buildOpportunities(signals);
    return NextResponse.json({ success: true, data: { opportunities, layout: signals.layout } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
