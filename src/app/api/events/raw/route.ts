import { NextResponse } from 'next/server';
import { getRawEvents } from '@/lib/analytics/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NOTE: gate behind restaurant-member auth once login is wired.
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const eventName = url.searchParams.get('event') ?? undefined;
    const sessionId = url.searchParams.get('session') ?? undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;
    const data = await getRawEvents({ eventName, sessionId, limit });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
