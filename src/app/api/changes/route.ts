import { NextResponse, type NextRequest } from 'next/server';
import { listChanges, logChange, type EntityType } from '@/lib/changes/repository';
import { requireSession, unauthorized } from '@/lib/auth/guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { readJsonCapped } from '@/lib/net/bounded';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 256_000;

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const data = await listChanges(session.restaurantSlug, 200, db);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}

// Manual log — for EXTERNAL actions the platform can't observe
// (printed menu reorder, Instagram campaign, photo shoot, table placement).
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const parsed = await readJsonCapped<{
      summary?: string;
      entityId?: string | null;
      changeType?: string;
      date?: string; // YYYY-MM-DD
    }>(req, MAX_BODY);
    if (!parsed.ok) {
      return parsed.reason === 'too_large' ? err('payload too large', 413) : err('invalid json');
    }
    const body = parsed.data;
    if (!body.summary || !body.summary.trim()) return err('summary is required');
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return err('date must be YYYY-MM-DD');
    const createdAt = body.date ? new Date(`${body.date}T12:00:00Z`).toISOString() : undefined;
    await logChange(
      session.restaurantSlug,
      {
        changeType: body.changeType?.trim() || 'external',
        entityType: (body.entityId ? 'cocktail' : 'external') as EntityType,
        entityId: body.entityId ?? null,
        summary: body.summary.trim(),
        source: 'manual',
        createdAt,
      },
      db,
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
