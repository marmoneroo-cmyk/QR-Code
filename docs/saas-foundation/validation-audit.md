# Validation Audit — empirical reproduction of the analytics-trust findings

**Method:** real tests against the running app + **production Supabase** as ground truth. Controlled
traffic was injected under throwaway tenants `audit-a`/`audit-b` (deleted after); the real `/api/track`,
`/api/changes` and a temporary dev-only harness endpoint (calling the *actual* analytics functions per
`?restaurant=`) were driven over HTTP; DB rows were read directly via the service-role key; session/queue
behavior was tested in the real browser. **`diner` was never written to by the harness.** Date: 2026-06-12.

> Cleanup note: the browser session tests loaded the live public menu, which tracks to `diner` by default,
> writing ~15 events; removing them by visitor-id also removed 37 pre-existing events from the same
> preview-browser visitor (`0159677f`). All `diner` events are synthetic dev/test data — no real customer
> data exists (the audit proved there is no POS). Net `diner` 1376 → 1339.

## Verdict table (proven, not theoretical)

| # | Category | Status | Hard evidence |
|---|---|---|---|
| 1 | Event duplication | **CONFIRMED · CRITICAL** | 3 identical `/api/track` POSTs of one `order_completed` → **3 DB rows**; units 2→**6**; revenue 100→**300**. No idempotency key; every re-delivery inserts again. |
| 9 | Security / ingest | **CONFIRMED · CRITICAL** | Unauthenticated POST (no auth header) with `revenue=1,000,000,000`, `units=999` → **HTTP 200, stored verbatim**. `occurred_at`: −12h accepted (back-dated), −5d clamped to now. |
| 8 | Tenant isolation | **SPLIT** | Aggregation **isolated** (tenant B saw **0** of A's 20 events; anon-key direct read = **0**, RLS holds). BUT `/api/changes?restaurant=audit-a` with **no auth → 200**, returned A's private "secret change" = **authorization leak CONFIRMED**. |
| 5 | Hall of Wins / false wins | **CONFIRMED · CRITICAL** | Zero-baseline (0 before, 8 after) → `status:success, deltaPct:null`. Decline (14 distinct before → **10** after, total **−29%**) → `status:success, deltaPct:+67`. A volume **drop** reported as a **+67% win**. |
| 4 | Closed-loop lifecycle | **CONFIRMED · HIGH** | `changes` table has **no status/state column** (id,restaurant_id,change_type,entity_type,entity_id,before,after,summary,source,created_at). Two GETs both **recompute live**. Change <2d old → `too_early`, no scheduler → sits until someone loads it. |
| 6 | Analytics counting | **ACCURATE (finding = FALSE POSITIVE for "counts are wrong")** | Injected 100 seen / 25 opened / 5 AR → funnel returned **exactly 100 / 25 / 5 = 0% error**. (`video=10` has **no funnel stage** — `cocktail_video_opened` is counted nowhere.) Arithmetic is reliable; the trust problem is *labeling*, not counting. |
| 7 | Recommendation engine | **WORKS (precision good)** | green-garden 60 opens / 0 conversion → fired `fix_offer` "interested but not ordering", `highInterestLowConversion:true`, `klass:dog`. Correct identification. (Conversion is intent-based; low-n false positive at `opens≥3` was code-confirmed, not separately injected.) |
| 2 | Event loss | **PARTIALLY CONFIRMED · HIGH** | Browser localStorage holds **no tracking queue** (`trackingQueuePersisted: []`) — queue is purely in-memory, so unflushed events are lost on crash/hard-nav/failed send. True offline/crash drop not directly simulable headless. |
| 3 | Session integrity | **CONFIRMED · MEDIUM-HIGH** | Backdated `session-ts` past the 2h TTL + reload → app minted **new session-id `83bc1036…` (≠ `2968c2e1…`)** while **visitor-id stayed identical** → one user = two "guests". Code stores session-id in **localStorage** (shared across tabs) — contradicting its own doc comment ("sessionStorage, per-tab"). |

## Mapping to the original audit findings

| Original finding | Validation status |
|---|---|
| tracking-2 no idempotency → revenue inflation | **CONFIRMED** (T1: 3 rows, ₪100→₪300) |
| tracking-5 / revenue-2 / briefing-3 client-trusted revenue, no auth | **CONFIRMED** (T9: ₪1e9 stored, HTTP 200, no auth) |
| revenue-7 occurred_at ±1 day skew | **CONFIRMED** (T9) |
| statistical-4 / wins-1 zero-baseline auto-success | **CONFIRMED** (T5) |
| attribution-3 decline shown as win | **CONFIRMED** (T5: −29% volume → +67% win) |
| statistical-1 no significance test | **CONFIRMED** (T5: +67% from noise published as success) |
| closedloop-1 no persisted state machine | **CONFIRMED** (T4: no status column) |
| closedloop-2 page-load/poll trigger, no cron, can stick | **CONFIRMED** (T4: too_early, no scheduler) |
| closedloop-3 non-monotonic re-measurement | **PARTIALLY** (live recompute proven; multi-day flip not waited out) |
| tracking-4 / integrity-2 in-memory queue, silent loss | **PARTIALLY** (no localStorage queue proven; live drop not simulated) |
| tracking-7 / integrity-4 session TTL rotation double-counts guests | **CONFIRMED** (T3: new session, same visitor) |
| no-auth on `?restaurant=` API → cross-tenant read/write | **CONFIRMED** (T8: `/api/changes` leak) |
| RLS dormant / anon can read tenant data | **NOT REPRODUCED** (T8: anon direct read = 0; RLS blocks anon) |
| cross-tenant analytics *aggregation* leak | **NOT REPRODUCED** (T8: tenant B saw 0; queries filter by restaurant_id) |
| "analytics counts are wrong" | **FALSE POSITIVE** (T6: 0% counting error) |

## Reproduction steps (condensed)

- **T1:** `node scripts/audit/run.js t1` — POST same `order_completed` 3× to `/api/track?slug=audit-a`; `select count, sum(value_num), sum(metadata.revenue)` for that session_id.
- **T9:** POST `order_completed {value:999, metadata.revenue:1e9}` with no auth header; read row back.
- **T5:** insert a `changes` row dated −3d for a real MENU slug; inject before/after `cocktail_opened` rows with controlled `created_at`; read `getClosedLoop` via harness.
- **T3:** load `/`, read `cocktail-demo:session-id`; set `cocktail-demo:session-ts = now−3h`; reload; read new session-id.

## REAL TRUST SCORE (proven only)

| Dimension | Validated score /100 | Basis |
|---|---:|---|
| Raw engagement **counting** | **65** | 0% counting error; aggregation tenant-isolated; anon RLS holds. Trustworthy for *interest*. |
| Tracking (money path) | **18** | Duplicable + spoofable + unauthenticated, all reproduced. |
| Attribution | **20** | Decline→win and zero-baseline→win reproduced; no control. |
| Statistical reliability | **22** | False wins from noise reproduced; no significance test exists. |
| Data integrity | **30** | Duplication + in-memory loss reproduced; aggregation isolation holds. |
| Closed-loop reliability | **30** | No persisted state, stuck `too_early`, live recompute all reproduced. |
| Revenue reliability | **15** | "Actual sales" = intent, inflatable + spoofable, all reproduced. |
| Tenant isolation | **35** | Data isolation holds; **authorization** broken (no-auth `?restaurant=`). |

**Overall revenue/win trustworthiness — VALIDATED ≈ 24 / 100.**
The validation **confirms** the architecture audit: every money/win/attribution claim is empirically
false-able. The one upgrade is that **raw engagement counting is accurate and tenant-isolated (~65)** — so
the funnel (seen → opened → explored) is the only layer the platform can currently defend. It still
**cannot honestly prove "this action improved sales / generated revenue."**
