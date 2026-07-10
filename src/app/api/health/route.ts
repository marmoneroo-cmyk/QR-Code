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

  // Best-effort freshness signal: seconds since the newest event landed. Independent of
  // the `db` check above and never throws — a missing table or transient error just
  // leaves this null instead of failing the whole health check.
  let lastEventAgeSeconds: number | null = null;
  try {
    const sb = createAdminSupabase();
    const { data, error } = await sb
      .from('events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    const latest = data?.[0]?.created_at;
    if (!error && latest) {
      const t = new Date(latest).getTime();
      if (Number.isFinite(t)) lastEventAgeSeconds = Math.round((Date.now() - t) / 1000);
    }
  } catch {
    lastEventAgeSeconds = null;
  }

  const body = {
    status: db === 'ok' ? 'ok' : 'degraded',
    checks: { db },
    lastEventAgeSeconds,
    ms: Date.now() - started,
  };
  if (db === 'down') {
    log.error('health', 'db connectivity check failed');
    return NextResponse.json(body, { status: 503 });
  }
  return NextResponse.json(body, { status: 200 });
}
