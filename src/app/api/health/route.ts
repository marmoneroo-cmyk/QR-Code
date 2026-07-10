import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/server';
import { log } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness + DB-connectivity health check for uptime monitors. Returns 200 when the app
 * can reach Supabase and 503 when it can't — e.g. the free-tier project auto-paused, which
 * is the early-warning signal BEFORE guests/operators hit "failed to fetch". Reveals only
 * up/down + a latency number; never data, tenant info, or internal error text.
 */
export async function GET(): Promise<NextResponse> {
  const started = Date.now();
  let db: 'ok' | 'down' = 'ok';
  try {
    const sb = createAdminSupabase();
    // Trivial connectivity probe — succeeds (even with 0 rows) when the DB is reachable.
    const { error } = await sb.from('restaurants').select('id').limit(1);
    if (error) db = 'down';
  } catch {
    db = 'down'; // network/DNS failure (paused project) or missing env
  }

  const body = { status: db === 'ok' ? 'ok' : 'degraded', checks: { db }, ms: Date.now() - started };
  if (db === 'down') {
    log.error('health', 'db connectivity check failed');
    return NextResponse.json(body, { status: 503 });
  }
  return NextResponse.json(body, { status: 200 });
}
