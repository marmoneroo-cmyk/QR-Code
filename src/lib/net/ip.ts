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

/**
 * Expand an IPv6 literal into its 8 numeric groups, or null if it does not parse.
 * Needed because the same address has many spellings, and a guard that only inspects
 * the leading group misses everything hidden behind a `::` run.
 */
function ipv6Groups(addr: string): number[] | null {
  const halves = addr.split('::');
  if (halves.length > 2) return null; // at most one zero-run
  const parse = (part: string): number[] =>
    part ? part.split(':').map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)) : [];
  const head = parse(halves[0] ?? '');
  if (halves.length === 1) {
    return head.length === 8 && head.every(Number.isFinite) ? head : null;
  }
  const tail = parse(halves[1] ?? '');
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  const groups = [...head, ...Array<number>(fill).fill(0), ...tail];
  return groups.length === 8 && groups.every(Number.isFinite) ? groups : null;
}

export function isBlockedIpv6(ip: string): boolean {
  const addr = (ip.split('%')[0] ?? '').toLowerCase(); // strip zone id
  // IPv4-mapped / -embedded in DOTTED form (::ffff:a.b.c.d, ::a.b.c.d).
  if (addr.includes('.')) {
    const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(addr);
    if (v4) return isBlockedIpv4(v4[1]!);
    return true; // dots but not a valid trailing IPv4 → malformed, fail closed
  }

  const groups = ipv6Groups(addr);
  if (groups === null) return true; // malformed → fail closed

  /*
   * The SAME address can be written without dots: `::ffff:7f00:1` IS 127.0.0.1 and
   * `::ffff:a9fe:a9fe` IS 169.254.169.254 (cloud metadata). Judging only the leading
   * group let those through, so the embedded IPv4 is reconstructed and judged here.
   * Covers both IPv4-mapped (::ffff:x:x) and the deprecated IPv4-compatible (::x:x),
   * which also captures `::1` and `::`.
   */
  if (groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0)) {
    const hi = groups[6]!;
    const lo = groups[7]!;
    return isBlockedIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
  }

  const head = groups[0]!;
  if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7  unique-local
  if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((head & 0xff00) === 0xff00) return true; // ff00::/8  multicast
  if (head === 0x2001 && groups[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  return false;
}

/** True when an IP literal is private/reserved/loopback/link-local and must be refused. */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP → fail closed
}
