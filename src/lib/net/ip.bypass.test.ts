import { describe, it, expect } from 'vitest';
import { isBlockedIp, isBlockedIpv6 } from './ip';

/**
 * IPv4-mapped IPv6 addresses can be written in HEX groups instead of dotted-quad:
 * `::ffff:7f00:1` is exactly `127.0.0.1`, and `::ffff:a9fe:a9fe` is `169.254.169.254`
 * (the cloud metadata endpoint). Both are valid IPv6 literals that `new URL()` accepts
 * inside brackets, so the SSRF guard must judge the EMBEDDED IPv4, not just the head group.
 */
describe('IPv4-mapped IPv6 written in hex groups is still blocked', () => {
  const cases: [string, string][] = [
    ['::ffff:7f00:1', '127.0.0.1 loopback'],
    ['::ffff:7f00:0001', '127.0.0.1 loopback padded'],
    ['::ffff:a9fe:a9fe', '169.254.169.254 cloud metadata'],
    ['::ffff:c0a8:1', '192.168.0.1 private'],
    ['::ffff:0a00:1', '10.0.0.1 private'],
    ['::ffff:ac10:1', '172.16.0.1 private'],
    ['0:0:0:0:0:ffff:7f00:1', '127.0.0.1 fully expanded'],
  ];

  for (const [addr, label] of cases) {
    it(`blocks ${addr} (${label})`, () => {
      expect(isBlockedIpv6(addr)).toBe(true);
      expect(isBlockedIp(addr)).toBe(true);
    });
  }

  it('still blocks the dotted-quad forms', () => {
    expect(isBlockedIpv6('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIpv6('::ffff:169.254.169.254')).toBe(true);
  });

  it('still blocks loopback / unspecified / unique-local / link-local', () => {
    expect(isBlockedIpv6('::1')).toBe(true);
    expect(isBlockedIpv6('::')).toBe(true);
    expect(isBlockedIpv6('fc00::1')).toBe(true);
    expect(isBlockedIpv6('fe80::1')).toBe(true);
    expect(isBlockedIpv6('ff02::1')).toBe(true);
  });

  it('does NOT block a genuine public IPv6 address', () => {
    expect(isBlockedIpv6('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
    expect(isBlockedIpv6('2a00:1450:4001:81f::200e')).toBe(false); // Google
  });

  it('fails closed on a malformed IPv6 literal', () => {
    expect(isBlockedIpv6('::ffff::7f00:1')).toBe(true);
    expect(isBlockedIpv6('nonsense')).toBe(true);
  });
});
