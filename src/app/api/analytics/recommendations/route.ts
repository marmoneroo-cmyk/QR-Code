import { NextResponse } from 'next/server';
import { getCoViews } from '@/lib/analytics/recommendations';
import { apiError } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public reads are cached at the CDN edge.
const PUBLIC_GET_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } as const;

// PUBLIC by design: powers the diner menu's "also viewed" (AlsoViewed / CocktailExperience),
// so it stays open — but errors are logged + genericized, never echoed to the client.
export async function GET(): Promise<NextResponse> {
  try {
    const data = await getCoViews();
    return NextResponse.json({ success: true, data }, { headers: PUBLIC_GET_HEADERS });
  } catch (error: unknown) {
    return apiError(error);
  }
}
