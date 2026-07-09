import 'server-only';
import { NextResponse } from 'next/server';
import { getSessionContext, type SessionContext } from './session';
import { log } from '@/lib/log';

/**
 * The single API auth boundary. Every admin/tenant API route calls requireSession()
 * and derives its tenant from session.restaurantSlug — NEVER from ?restaurant= or the
 * request body. requireSession() throws when there is no valid session OR the user is
 * not a member of any restaurant (getSessionContext returns null in both cases), so an
 * authenticated-but-non-member cannot reach tenant data.
 *
 * The public diner path (POST /api/track) does NOT use this — diners are anonymous.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** Verified tenant context for the current request, or throws UnauthorizedError. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) throw new UnauthorizedError();
  return session;
}

/**
 * Uniform error → JSON response for guarded routes. An UnauthorizedError becomes a 401
 * (so the client can redirect to login). Anything else is an UNEXPECTED failure: it is
 * logged in full server-side (this one seam observes every guarded route) and the
 * client gets a GENERIC message — internal error details (SQL/table/constraint names)
 * must never leak into a response body.
 */
export function unauthorized(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  log.error('api', error instanceof Error ? error.message : 'unexpected error', {
    stack: error instanceof Error ? error.stack : undefined,
  });
  return NextResponse.json({ success: false, error: 'internal error' }, { status: 500 });
}

/**
 * Canonical error responder for ANY route — public or guarded. Same behavior as
 * `unauthorized`: 401 for an UnauthorizedError, otherwise the real failure is logged
 * in full server-side and the client gets a generic message (never raw SQL/table/
 * exception text). PUBLIC routes import THIS name — they never throw UnauthorizedError,
 * so it is purely "log + generic 500". One seam for all route error hygiene.
 */
export const apiError = unauthorized;
