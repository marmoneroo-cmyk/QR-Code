import { NextResponse } from 'next/server';
import { getIntegrityReport } from '@/lib/analytics/queries';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();
    const data = await getIntegrityReport();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
