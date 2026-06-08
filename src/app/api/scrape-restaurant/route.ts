import { NextResponse } from 'next/server';
import { scrapeRestaurant } from '@/lib/restaurant-scraper';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Body {
  url: string;
}

export async function POST(req: Request): Promise<Response> {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
