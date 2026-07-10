import { describe, it, expect } from 'vitest';
import { assertPublicUrl } from './ssrf';

/**
 * URL-validation layer of the SSRF guard. These cover the branches that need no live DNS
 * (parse failures, protocol allow-list, and IP-literal hosts); the IP classification
 * itself is covered exhaustively in ip.test.ts. Testable at all only because
 * vitest.config.ts stubs `server-only`.
 */
describe('assertPublicUrl', () => {
  it('rejects an unparseable URL', async () => {
    await expect(assertPublicUrl('not a url')).rejects.toThrow('invalid url');
  });

  it('rejects non-http(s) protocols (no file:/ftp: SSRF pivot)', async () => {
    await expect(assertPublicUrl('ftp://example.com/x')).rejects.toThrow('unsupported protocol');
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow('unsupported protocol');
  });

  it('rejects the cloud-metadata IP literal', async () => {
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      'blocked address',
    );
  });

  it('rejects loopback / private IP literals, including bracketed IPv6', async () => {
    await expect(assertPublicUrl('http://127.0.0.1:8080/')).rejects.toThrow('blocked address');
    await expect(assertPublicUrl('http://10.0.0.5/')).rejects.toThrow('blocked address');
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow('blocked address');
  });

  it('allows a public IP literal without any DNS lookup', async () => {
    const u = await assertPublicUrl('http://8.8.8.8/robots.txt');
    expect(u.hostname).toBe('8.8.8.8');
  });
});
