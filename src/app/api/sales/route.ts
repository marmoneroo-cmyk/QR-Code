import { NextResponse, type NextRequest } from 'next/server';
import { importSales, listSalesByItem, type SaleInput } from '@/lib/sales/repository';
import { isValidSaleInput, MAX_SALES_ROWS } from '@/lib/sales/validate';
import { requireSession, unauthorized } from '@/lib/auth/guard';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const body = (await req.json()) as {
      periodStart?: string;
      periodEnd?: string;
      rows?: SaleInput[];
    };
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
