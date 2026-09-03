---
name: security-ssrf-ipv6-bypass
description: "The SSRF IP guard must judge IPv4-mapped IPv6 in HEX form, not just dotted — this was a live cloud-metadata bypass"
metadata: 
  node_type: memory
  type: project
  originSessionId: 863cfba6-3fbc-44be-a19e-ca0befc42724
---

Fixed 2026-07-20. `src/lib/net/ip.ts` (`isBlockedIpv6`) judged IPv4-mapped IPv6 only when
written in DOTTED form (`::ffff:127.0.0.1`). The same addresses in HEX groups sailed through:

- `::ffff:7f00:1`    = 127.0.0.1        → was NOT blocked
- `::ffff:a9fe:a9fe` = 169.254.169.254  → was NOT blocked (**cloud metadata → credentials**)

Cause: `addr.includes('.')` was false, so the embedded-IPv4 branch was skipped; then
`addr.split(':')[0]` on a string starting with `:` yielded `''` → `head = 0` → no mask
matched → allowed. Any authenticated tenant member could point `/api/scrape-restaurant`
at cloud metadata and have the response streamed back.

Fix: expand the literal to all 8 IPv6 groups (`ipv6Groups`), and when groups 0–4 are zero
and group 5 is `0xffff` (IPv4-mapped) or `0` (IPv4-compatible), reconstruct the embedded
IPv4 and judge it with `isBlockedIpv4`. Malformed literals fail closed.

**Rule for any future change here: one address has many spellings. Judge the resolved
value, never the surface text.** Regression tests live in `src/lib/net/ip.bypass.test.ts`.

Surrounding guard is otherwise sound and should be preserved: `assertPublicUrl` checks the
protocol allowlist, validates EVERY DNS-resolved address (not just the first), and
`safeFetch` follows redirects manually re-validating each hop. Residual known gap: DNS
rebinding TOCTOU (needs IP-pinned connects), documented in `src/lib/net/ssrf.ts`.

Related: [[project_no_fabricated_numbers]], [[security_rls_readpath_verified]].
