import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isBlockedIp } from './ip';

/**
 * SSRF guard for server-side outbound fetches of user-supplied URLs (the restaurant
 * scraper). Without this, an authenticated caller can point the server at
 * `http://169.254.169.254/…` (cloud metadata → credential theft) or any internal /
 * loopback / RFC-1918 host and have the response streamed back.
 *
 * Strategy: resolve the host and refuse if ANY resolved address is private/reserved
 * (see `./ip`), then follow redirects MANUALLY, re-validating every hop (a public URL
 * can 302 to an internal one). Residual TOCTOU: DNS could rebind between lookup and
 * connect — fully closing that needs IP-pinned connects; this proportionate guard
 * blocks the real metadata/internal-host threat for this app.
 */

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10_000;

/** Validate protocol + resolve the host, throwing if it is (or resolves to) a blocked address. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('invalid url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('unsupported protocol');
  const host = u.hostname.replace(/^\[|\]$/g, ''); // unwrap bracketed IPv6
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new Error('blocked address');
    return u;
  }
  const resolved = await lookup(host, { all: true });
  if (resolved.length === 0) throw new Error('unresolved host');
  for (const r of resolved) {
    if (isBlockedIp(r.address)) throw new Error('blocked address');
  }
  return u;
}

/**
 * Fetch a user-supplied URL with SSRF protection: validate the target, follow redirects
 * manually, and re-validate every hop. Times out so a slow internal host can't hang a lambda.
 */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  maxRedirects: number = MAX_REDIRECTS,
): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(u, { ...init, redirect: 'manual', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, u).toString(); // resolve relative redirects
      continue;
    }
    return res;
  }
  throw new Error('too many redirects');
}
