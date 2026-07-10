import { NextResponse } from 'next/server';
import { scrapeRestaurant } from '@/lib/restaurant-scraper';
import { requireSession, unauthorized } from '@/lib/auth/guard';
import { readJsonCapped } from '@/lib/net/bounded';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BODY = 256_000;

interface Body {
  url: string;
}

export async function POST(req: Request): Promise<Response> {
  // Authenticate FIRST — an anonymous caller must not reach body parsing or the
  // outbound fetch (this route takes an arbitrary URL = an SSRF surface; see follow-up).
  try {
    await requireSession();
  } catch (error: unknown) {
    return unauthorized(error);
  }

  const parsed = await readJsonCapped<Body>(req, MAX_BODY);
  if (!parsed.ok) {
    return parsed.reason === 'too_large'
      ? NextResponse.json({ success: false, error: 'payload too large' }, { status: 413 })
      : NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const body = parsed.data;

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
  }

  try {
    const menu = await scrapeRestaurant(body.url);
    return NextResponse.json({ success: true, data: menu });
  } catch {
    // Distinct from the requireSession() 401 above: a bad/unreachable target
    // URL is a client-caused failure (bad gateway), not an internal error.
    return NextResponse.json({ success: false, error: 'could not reach that site' }, { status: 502 });
  }
}
