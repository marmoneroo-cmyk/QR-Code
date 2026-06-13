import { NextResponse } from 'next/server';
import { getRawEvents } from '@/lib/analytics/queries';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const url = new URL(request.url);
    const eventName = url.searchParams.get('event') ?? undefined;
    const sessionId = url.searchParams.get('session') ?? undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;
    const data = await getRawEvents({ eventName, sessionId, limit });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
