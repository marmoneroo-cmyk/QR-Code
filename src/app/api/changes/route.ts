import { NextResponse, type NextRequest } from 'next/server';
import { listChanges, logChange, type EntityType } from '@/lib/changes/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const restaurant = req.nextUrl.searchParams.get('restaurant') ?? 'diner';
    const data = await listChanges(restaurant);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}

// Manual log — for EXTERNAL actions the platform can't observe
// (printed menu reorder, Instagram campaign, photo shoot, table placement).
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      restaurant?: string;
      summary?: string;
      entityId?: string | null;
      changeType?: string;
      date?: string; // YYYY-MM-DD
    };
    const restaurant = body.restaurant ?? 'diner';
    if (!body.summary || !body.summary.trim()) return err('summary is required');
    const createdAt = body.date ? new Date(`${body.date}T12:00:00Z`).toISOString() : undefined;
    await logChange(restaurant, {
      changeType: body.changeType?.trim() || 'external',
      entityType: (body.entityId ? 'cocktail' : 'external') as EntityType,
      entityId: body.entityId ?? null,
      summary: body.summary.trim(),
      source: 'manual',
      createdAt,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}
