import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Auth proxy (Next 16's renamed Middleware) — refreshes the Supabase session on
 * every /admin/* request and, when AUTH_ENFORCED is on, gates the admin console
 * behind login.
 *
 * SAFE ROLLOUT: enforcement is OFF by default (AUTH_ENFORCED !== 'true'), so
 * deploying this never locks anyone out of /admin. Flip AUTH_ENFORCED=true only
 * after an owner user + restaurant_members row exist (see docs/saas-foundation).
 * If Supabase env is missing, this is a no-op (never blocks).
 *
 * Scope: gates /admin/* only. Per-route API auth lands with the CRUD→RLS flip
 * (the public menu still needs anonymous GETs + POST /api/track, so a blanket
 * /api gate here would be wrong).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // network/auth hiccup → treat as logged-out; only matters if enforced below.
  }

  if (process.env.AUTH_ENFORCED !== 'true') return response;

  const path = request.nextUrl.pathname;
  const isLogin = path === '/admin/login';

  if (!user && !isLogin) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/admin/login';
    redirect.search = '';
    redirect.searchParams.set('next', path);
    return NextResponse.redirect(redirect);
  }
  if (user && isLogin) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/admin';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
