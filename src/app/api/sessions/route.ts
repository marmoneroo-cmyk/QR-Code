import { NextResponse } from 'next/server';
import { getSessionJourneys } from '@/lib/analytics/journeys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const data = await getSessionJourneys(40);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
