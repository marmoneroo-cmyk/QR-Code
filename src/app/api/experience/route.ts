import { NextResponse, type NextRequest } from 'next/server';
import { listExperience, upsertExperience } from '@/lib/experience/repository';
import { logChange } from '@/lib/changes/repository';
import type { ExperienceConfig } from '@/lib/experience/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const restaurant = req.nextUrl.searchParams.get('restaurant') ?? 'diner';
    const data = await listExperience(restaurant);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}

// NOTE (Phase 2): gate behind restaurant-member auth once login is wired.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { restaurant?: string; slug?: string; config?: ExperienceConfig };
    const restaurant = body.restaurant ?? 'diner';
    if (typeof body.slug !== 'string' || !body.slug) return err('slug is required');
    if (typeof body.config !== 'object' || body.config === null) return err('config is required');
    await upsertExperience(restaurant, body.slug, body.config);
    await logChange(restaurant, {
      changeType: 'experience_updated',
      entityType: 'cocktail',
      entityId: body.slug,
      after: body.config,
      summary: `Experience updated: ${body.slug}`,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}
