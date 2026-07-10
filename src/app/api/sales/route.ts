import { NextResponse, type NextRequest } from 'next/server';
import { importSales, listSalesByItem, type SaleInput } from '@/lib/sales/repository';
import { isValidSaleInput, MAX_SALES_ROWS } from '@/lib/sales/validate';
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
    const data = await listSalesByItem(session.restaurantSlug, db);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const parsed = await readJsonCapped<{
      periodStart?: string;
      periodEnd?: string;
      rows?: SaleInput[];
    }>(req, MAX_BODY);
    if (!parsed.ok) {
      return parsed.reason === 'too_large' ? err('payload too large', 413) : err('invalid json');
    }
    const body = parsed.data;
    if (!body.periodStart || !body.periodEnd) return err('periodStart and periodEnd are required');
    if (!Array.isArray(body.rows) || body.rows.length === 0) return err('rows are required');
    if (body.rows.length > MAX_SALES_ROWS) return err(`rows must not exceed ${MAX_SALES_ROWS}`);
    if (!body.rows.every(isValidSaleInput)) {
      return err('each row requires slug (string), units (number), revenue (number)');
    }
    const imported = await importSales(session.restaurantSlug, body.periodStart, body.periodEnd, body.rows, db);
    return NextResponse.json({ success: true, data: { imported } });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
