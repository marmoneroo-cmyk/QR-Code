import { isIP } from 'node:net';

/**
 * Pure IP classification for the SSRF guard — no IO, no `server-only`, fully unit-testable.
 * The fetch/DNS wrapper lives in `./ssrf`; this module is just "is this address one we must
 * never let a user-driven fetch reach?" (private / reserved / loopback / link-local / metadata).
 */

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = [m[1], m[2], m[3], m[4]].map((p) => Number(p));
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function inCidr(ipInt: number, base: string, bits: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/** IPv4 ranges that must never be reachable from a user-driven fetch (RFC 1918/6890 + metadata). */
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32],
];

export function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → fail closed
  return BLOCKED_V4.some(([base, bits]) => inCidr(n, base, bits));
}

export function isBlockedIpv6(ip: string): boolean {
  const addr = (ip.split('%')[0] ?? '').toLowerCase(); // strip zone id
  if (addr === '::1' || addr === '::') return true;
  // IPv4-mapped / -embedded (::ffff:a.b.c.d, ::a.b.c.d) → judge the embedded IPv4.
  if (addr.includes('.')) {
    const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(addr);
    if (v4) return isBlockedIpv4(v4[1]!);
  }
  const head = parseInt(addr.split(':')[0] || '0', 16);
  if (Number.isNaN(head)) return true; // malformed → fail closed
  if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7  unique-local
  if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((head & 0xff00) === 0xff00) return true; // ff00::/8  multicast
  if (addr.startsWith('2001:db8')) return true; // documentation
  return false;
}

/** True when an IP literal is private/reserved/loopback/link-local and must be refused. */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP → fail closed
}
