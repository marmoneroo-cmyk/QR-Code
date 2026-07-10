import { NextResponse, type NextRequest } from 'next/server';
import { listExperience, upsertExperience } from '@/lib/experience/repository';
import { logChange } from '@/lib/changes/repository';
import type { ExperienceConfig } from '@/lib/experience/types';
import { isValidExperienceConfig } from '@/lib/experience/validate';
import { requireSession, unauthorized, apiError } from '@/lib/auth/guard';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Public reads are cached at the CDN edge; writes stay uncached (session-scoped).
const PUBLIC_GET_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } as const;

// PUBLIC read: the diner menu (useMenuConfig) fetches its restaurant's experience config.
// `menu_experience` is public-read by RLS (it drives anonymous rendering), so the
// ?restaurant= param exposes only public data. The PUT handler is the boundary.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const restaurant = req.nextUrl.searchParams.get('restaurant') ?? 'diner';
    const data = await listExperience(restaurant);
    return NextResponse.json({ success: true, data }, { headers: PUBLIC_GET_HEADERS });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const body = (await req.json()) as { slug?: string; config?: ExperienceConfig };
    if (typeof body.slug !== 'string' || !body.slug) return err('slug is required');
    if (typeof body.config !== 'object' || body.config === null) return err('config is required');
    if (!isValidExperienceConfig(body.config)) return err('invalid config', 400);
    await upsertExperience(session.restaurantSlug, body.slug, body.config, db);
    await logChange(
      session.restaurantSlug,
      {
        changeType: 'experience_updated',
        entityType: 'cocktail',
        entityId: body.slug,
        after: body.config,
        summary: `Experience updated: ${body.slug}`,
      },
      db,
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
