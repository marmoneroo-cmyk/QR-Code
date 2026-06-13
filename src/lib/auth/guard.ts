import 'server-only';
import { NextResponse } from 'next/server';
import { getSessionContext, type SessionContext } from './session';

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
 * (so the client can redirect to login); anything else is a 500 with its message.
 */
export function unauthorized(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : 'unexpected error';
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
