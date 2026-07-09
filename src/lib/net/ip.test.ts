import { describe, it, expect } from 'vitest';
import { isBlockedIp, isBlockedIpv4, isBlockedIpv6 } from './ip';

describe('isBlockedIpv4', () => {
  it('blocks the cloud metadata address and link-local range', () => {
    expect(isBlockedIpv4('169.254.169.254')).toBe(true); // AWS/GCP metadata
    expect(isBlockedIpv4('169.254.0.1')).toBe(true);
  });

  it('blocks loopback and every RFC-1918 private range', () => {
    expect(isBlockedIpv4('127.0.0.1')).toBe(true);
    expect(isBlockedIpv4('10.1.2.3')).toBe(true);
    expect(isBlockedIpv4('172.16.5.4')).toBe(true);
    expect(isBlockedIpv4('192.168.0.1')).toBe(true);
    expect(isBlockedIpv4('100.64.0.1')).toBe(true); // CGNAT
    expect(isBlockedIpv4('0.0.0.0')).toBe(true);
  });

  it('allows genuine public addresses', () => {
    expect(isBlockedIpv4('8.8.8.8')).toBe(false);
    expect(isBlockedIpv4('1.1.1.1')).toBe(false);
    expect(isBlockedIpv4('93.184.216.34')).toBe(false); // example.com
    expect(isBlockedIpv4('172.15.0.1')).toBe(false); // just OUTSIDE 172.16/12
    expect(isBlockedIpv4('172.32.0.1')).toBe(false); // just above 172.16/12
  });

  it('fails closed on unparseable input', () => {
    expect(isBlockedIpv4('999.1.1.1')).toBe(true);
    expect(isBlockedIpv4('not-an-ip')).toBe(true);
  });
});

describe('isBlockedIpv6', () => {
  it('blocks loopback, unspecified, ULA, link-local, multicast', () => {
    expect(isBlockedIpv6('::1')).toBe(true);
    expect(isBlockedIpv6('::')).toBe(true);
    expect(isBlockedIpv6('fc00::1')).toBe(true); // unique-local
    expect(isBlockedIpv6('fd12:3456::1')).toBe(true);
    expect(isBlockedIpv6('fe80::1')).toBe(true); // link-local
    expect(isBlockedIpv6('ff02::1')).toBe(true); // multicast
  });

  it('unwraps IPv4-mapped addresses and judges the embedded IPv4', () => {
    expect(isBlockedIpv6('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIpv6('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedIpv6('::ffff:8.8.8.8')).toBe(false);
  });

  it('allows a public IPv6 (Google DNS)', () => {
    expect(isBlockedIpv6('2001:4860:4860::8888')).toBe(false);
  });
});

describe('isBlockedIp', () => {
  it('routes by family and fails closed on non-IPs', () => {
    expect(isBlockedIp('10.0.0.1')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('example.com')).toBe(true); // hostname, not an IP → fail closed
    expect(isBlockedIp('')).toBe(true);
  });
});
