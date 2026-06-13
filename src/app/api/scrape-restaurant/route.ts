import { NextResponse } from 'next/server';
import { scrapeRestaurant } from '@/lib/restaurant-scraper';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    const menu = await scrapeRestaurant(body.url);
    return NextResponse.json(menu);
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
