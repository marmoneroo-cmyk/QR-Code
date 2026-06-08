import { NextResponse } from 'next/server';
import { getTableIntelligence } from '@/lib/analytics/tables';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NOTE (Phase 2): gate behind restaurant-member auth once login is wired.
export async function GET(): Promise<NextResponse> {
  try {
    const data = await getTableIntelligence();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
