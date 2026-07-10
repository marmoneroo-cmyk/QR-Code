import { NextResponse } from 'next/server';
import { listExperience } from '@/lib/experience/repository';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Guarded, session-scoped experience-config read for the ADMIN editor. Tenant comes from
 * the verified session (never `?restaurant=`). The public `/api/experience?restaurant=`
 * GET is unchanged — it drives anonymous diner rendering and must stay auth-free.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const data = await listExperience(session.restaurantSlug);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
