---
name: reference-livecheck-harness
description: How to run the opt-in live read-path diagnostic against the real database
metadata: 
  node_type: memory
  type: reference
  originSessionId: 863cfba6-3fbc-44be-a19e-ca0befc42724
---

`src/lib/analytics/livecheck.test.ts` drives every owner-side read function against the
REAL database to prove they work on real data. It is `describe.skipIf`-guarded so it NEVER
touches a database during a normal or CI test run.

Run it:

```bash
LIVECHECK=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run \
  src/lib/analytics/livecheck.test.ts
```

Two gotchas that cost time on 2026-07-20:
- `loadEnvConfig` from `@next/env` did NOT populate env under vitest — inject env with
  `node --env-file=.env.local` running vitest's CLI directly, as above.
- vitest captures `console.log`, so the harness writes `livecheck-report.txt` (gitignored).

Interpreting it: most of these functions SWALLOW errors and return an empty fallback, so
"did not throw" proves nothing. An EMPTY result is the signal worth chasing — but verify the
source data exists first. On 2026-07-20, 18/20 returned real data; the two EMPTY ones were
legitimate (`sales` table had 0 rows, and 0 events carried a table identifier).

Related: [[project_no_fabricated_numbers]].
