import { NextResponse, type NextRequest } from 'next/server';
import { importSales, listSalesByItem, type SaleInput } from '@/lib/sales/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const restaurant = req.nextUrl.searchParams.get('restaurant') ?? 'diner';
    const data = await listSalesByItem(restaurant);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}

// NOTE (Phase 2): gate behind restaurant-member auth once login is wired.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      restaurant?: string;
      periodStart?: string;
      periodEnd?: string;
      rows?: SaleInput[];
    };
    const restaurant = body.restaurant ?? 'diner';
    if (!body.periodStart || !body.periodEnd) return err('periodStart and periodEnd are required');
    if (!Array.isArray(body.rows) || body.rows.length === 0) return err('rows are required');
    const imported = await importSales(restaurant, body.periodStart, body.periodEnd, body.rows);
    return NextResponse.json({ success: true, data: { imported } });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'unexpected error', 500);
  }
}
