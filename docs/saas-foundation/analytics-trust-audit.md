# Analytics Trust Audit — can the platform prove "this action improved sales"?

**Method:** 8 subsystem auditors read the actual code (Read + Grep), every CRITICAL/HIGH finding was
re-verified by an independent agent against the cited lines. 46 agents, evidence cited as `file:line`.
**Date:** 2026-06-12.

## VERDICT (read this first)

> **No. The platform cannot honestly prove that any action improved sales or generated revenue.**
> Every one of the 8 subsystems returned `canProveRevenue = false`, for the **same root cause**:

**There is no sale anywhere in the system.** `order_completed` is fired by the "Show waiter / My Picks"
button, whose own header says *"NOT an ordering system (no POS, no kitchen, no fulfilment)… we capture
purchase INTENT and never claim a sale"* (`src/components/OrderBar.tsx:9-19`). That intent tap — with a
**revenue number the browser computes itself** (`meta.revenue = count * priceILS`, `OrderBar.tsx:60`) — is
summed (`queries.ts:206-217`) and rendered under a panel literally titled **"Actual sales / מכירות בפועל"**
captioned **"Real measured revenue / הכנסה אמיתית שנמדדה"** (`revenue/page.tsx:258-274`).

So the flagship number is **intent, priced by the client, relabeled as measured sales** — and on top of
that it can be **duplicated** (no idempotency), **spoofed** (unauthenticated ingest), and **attributed
without any control group**. The math layer can even turn a **decline into a "+win"** and auto-declare a
brand-new item a **"Success."**

---

## TRUST SCORE (Phase 8)

| Dimension | Score /100 | One-line reason |
|---|---:|---|
| **Tracking Accuracy** | **38** | Funnel stages use `count(distinct session_id)` (good), but the money path sums raw rows with no idempotency and trusts client values. |
| **Attribution Accuracy** | **26** | Before/after on one item, no control/holdout; all external trend is credited to the action. |
| **Statistical Reliability** | **28** | Minimum-count gates only; **zero** significance tests/CIs; rates off n=2–3; zero-baseline auto-success. |
| **Data Integrity** | **28** | In-memory queue (silent loss), no idempotency (silent inflation), slug-keyed history, errors swallowed to "0". |
| **Closed-Loop Reliability** | **38** | No persisted state machine; live re-measurement is non-monotonic; trigger is a page load, not a cron. |
| **Revenue Reliability** | **22** | Headline ₪ is intent × client price, or estimate × price; the one real-POS path has no idempotency. |
| *(supporting)* Hall of Wins | 38 | Honestly filters `status==='success'`, but the "win" is engagement lift on untrusted, spoofable events. |
| *(supporting)* Briefing/Actions/Opps | 42 | Generators are disciplined; their **inputs** (intent priced as money) are not. |

**Overall revenue-impact trustworthiness: ~26 / 100 — NOT trustworthy for any sales/revenue claim.**
The engagement-funnel layer (impressions → opens → ingredients) is materially more trustworthy (~60) and
is the only thing the platform can currently defend.

---

## 1. Architecture diagram

```
 PUBLIC MENU (browser, anonymous)                          OWNER ADMIN (authed*)
 ┌───────────────────────────────┐                         ┌──────────────────────────────┐
 │ CocktailExperience / OrderBar │                         │ Revenue · Wins · Closed-Loop  │
 │ ImpressionTracker · useEngage │                         │ Home · Actions · Opportunities│
 └──────────────┬────────────────┘                         └───────────────┬──────────────┘
                │ track(event)                                              │ GET (on page load / poll)
                ▼                                                           ▼
   src/lib/tracking/track.ts ──► queue.ts (IN-MEMORY buffer, 4s/visibility)  src/lib/analytics/queries.ts
                │  POST /api/track  (NO AUTH, NO RATE LIMIT)                  src/lib/value/* · closedloop/*
                ▼                                                           ▲
   src/app/api/track/route.ts  ── stores value_num + metadata VERBATIM      │ reads
                │  .insert(rows)  (NO idempotency key)                       │
                ▼                                                           │
   Supabase  events table  ◄──────────── changes table (operator-logged) ──┘
   (cocktail_slug TEXT, no FK)            sales table (real CSV import, no idempotency)
```
`* /admin is auth-gated only when AUTH_ENFORCED=true; /api/track and /api/changes are open.`

## 2. Event-flow diagram

```
 user action ─► track({event,value,metadata})
                   │  (no event_id minted)
                   ▼
              queue.buffer.push()           ◄── IN RAM ONLY; lost on hard nav / crash
                   │ flush on: 4s timer  AND  visibilitychange:hidden  AND  pagehide   ← double-fire
                   ▼
              sendBeacon → /api/track  (fetch keepalive fallback)   ← can deliver same batch twice
                   │  buffer cleared BEFORE send confirms; failures .catch(()=>{})  ← silent loss
                   ▼
              events.insert(rows)  (server clock clamps occurred_at to ±1 day; trusts session_id)
                   ▼
        ┌── funnel/overview reads ──────────────────────────────────────────┐
        │ STAGE counts = count(DISTINCT session_id)   ✅ dup-resistant       │
        │ MONEY (units/revenue/profit) = SUM(value_num / metadata.revenue)  ❌ dup-INFLATED, client-set │
        └───────────────────────────────────────────────────────────────────┘
```

## 3. Attribution-flow diagram

```
 operator logs a "change" (type, slug, DATE he can backdate)   POST /api/changes (open)
        │  createdAt = chosen date  ◄── this date IS the measurement boundary
        ▼
 getClosedLoop (server.ts) — recomputed LIVE every request (no stored state):
        metricFor(type): promotion→'intent'  experience→'opens'  else 'opens'   ('sales' path = DEAD code)
        beforeSessions = distinct sid in [appliedAt−7d, appliedAt)
        afterSessions  = distinct sid in [appliedAt, now]           ◄── window grows each reload
        │   NO control group · NO holdout · NO concurrency guard · NO seasonality/day-of-week adj
        ▼
 measureImpact (measure.ts):
        beforeRate = before/7 ;  afterRate = after/min(daysSince,7)     ◄── partial after vs full before
        if beforeRate==0 && after>=8 ─► SUCCESS (deltaPct=null → shown "+0%")   ◄── auto-win
        deltaPct = (afterRate−beforeRate)/beforeRate ; if >0 ─► SUCCESS         ◄── no significance test
        ▼
 Hall of Wins / Revenue "Proven" counter   ◄── external trend credited to the action; can flip & vanish
```

## 4. Revenue-calculation flow (two paths, both unproven)

```
 PATH A — "Actual sales / Real measured revenue"   (revenue/page.tsx:258-274)
   totalRevenue = Σ over order_completed rows of (metadata.revenue ?? value_num*price)   [queries.ts:206-217]
        ▲ order_completed = "Show waiter" INTENT tap (OrderBar.tsx:9-19)
        ▲ metadata.revenue = count*priceILS computed in the BROWSER (OrderBar.tsx:60)
        ▲ stored verbatim by unauthenticated /api/track (route.ts:62-63); no dedup → inflatable & spoofable

 PATH B — "Available now · est." hero ₪  (potential.ts:84-101)
   extraOrders = views * convGap            (convGap = benchmarkConv − itemConv, intent-derived)
   revenueILS  = round(extraOrders * price)  ← estimate × price, stacked on the same intent rates

 PATH C — Executive "Projected ₪/mo"  (executive/page.tsx:27-33)
   orders = max(8, round(attentionScore/100 * 24)) ; customers = max(4, orders*0.6) ; rev = orders*price
        ▲ hardcoded floors 8/4, magic multipliers 24/0.6, invented "AI confidence"

 PATH D — Sales CSV (the ONLY transaction-backed input)  (sales/repository.ts:38-58)
   plain .insert() with NO unique key → re-importing a file double-counts real revenue
```

## 5. Hall of Wins — validation rules

**What the code actually requires for a "win" (`measure.ts` + `wins/page.tsx:75-77`):**

| Gate | Actual value | Verdict |
|---|---|---|
| Min days since change | `< min(2, W)` ⇒ too_early | weak (2 days) |
| Min sample (before+after) | `before+after < 8` ⇒ insufficient_data | far too low |
| No-effect band | `|deltaPct| < 10%` ⇒ no_effect | arbitrary, no CI |
| Direction | `deltaPct > 0` ⇒ success | **no significance test** |
| Zero baseline | `before=0 && after>=8` ⇒ **success (deltaPct=null → "+0%")** | **false win** |
| Min views/orders/confidence | **none of these gate a win** | missing |
| Min measurable **money** impact | **none — win is opens/intent lift, never ₪** | missing |
| Source authenticity | events via **unauthenticated** `/api/track`; change date **operator-backdatable** | spoofable |

**What a trustworthy win MUST require (recommended):** real POS-backed outcome metric tied to the change
hypothesis; ≥ ~30 distinct sessions per arm AND ≥ full after-window; two-proportion z-test / Wilson lower
bound > 0; a control or matched-prior baseline (difference-in-differences); a **frozen, immutable** result
at window close; server-authenticated events; change timestamp = server insert time (not backdatable).

## 6. Top 20 critical risks

| # | Sev | Risk | Evidence |
|---|---|---|---|
| 1 | CRIT | Intent ("Show waiter") summed & shown as **"Actual sales / Real measured revenue"** | `OrderBar.tsx:9-19,64-69` · `queries.ts:206-217` · `revenue/page.tsx:258-274` |
| 2 | CRIT | Revenue/profit computed **client-side** & stored verbatim by **unauthenticated** ingest → spoofable (`revenue=1e9`) | `OrderBar.tsx:60-63` · `track/route.ts:62-63` (no auth) |
| 3 | CRIT | **No idempotency key** + dual flush (visibility+pagehide) → duplicate `order_completed` inflates money | `track/route.ts:99` · `queue.ts:59-63` · `schema.sql:106-123` |
| 4 | CRIT | **No control/holdout** — weekend/campaign/seasonality/other changes all credited to the action | `server.ts:96-112` |
| 5 | CRIT | **No significance test / CI anywhere** — before=10/after=20 published as "+100% Success" | `measure.ts:26-39` |
| 6 | CRIT | Two unreconciled "sales" sources: real POS feeds heuristics, **intent** feeds the ₪ number | `menu-signals.ts:57,158` vs `potential.ts:84` |
| 7 | HIGH | **Zero-baseline auto-success**: any new item w/ ≥8 sessions ⇒ "Success", shown "+0%" | `measure.ts:31-33` · `wins/page.tsx:76` |
| 8 | HIGH | measure.ts can show a **decline as a win** (partial after vs full 7-day before) | `measure.ts:26-29` · `measure.test.ts:32-44` |
| 9 | HIGH | Closed Loop **never measures sales** — 'sales' metric path is unreachable dead code, yet feeds "Proven" | `server.ts:17,22-26` |
| 10 | HIGH | **No persisted state machine**; live re-measure is **non-monotonic** — a counted win can flip & vanish | `server.ts:87-94` · `schema.sql:177-188` |
| 11 | HIGH | Measurement trigger is **page-load/poll, not cron** — items get stuck or judged at a moving instant | `wins/page.tsx:118` · no `crons` config |
| 12 | HIGH | **In-memory queue**, buffer cleared before send confirms, failures swallowed → silent event loss | `queue.ts:14,40,51-53` |
| 13 | HIGH | Operator **self-authors AND backdates** the change = the measurement boundary → can engineer a win | `api/changes/route.ts:34` · `server.ts:93-94` |
| 14 | HIGH | Rates computed from denominators as small as **2–3 views** (no minimum-n) | `queries.ts:494` · `build.ts:85` |
| 15 | HIGH | A correct **readiness gate exists** (n≥500, 95% coverage, 7 ready days) but does **not** gate wins/revenue/opps | `signals.ts:248-269` |
| 16 | HIGH | Margin/profit can rest on a **hardcoded seeded cost** map when costILS unset | `cocktail.ts:1195-1212` |
| 17 | HIGH | Executive "Projected ₪/mo" & "AI confidence" = **hardcoded floors + magic numbers** | `executive/page.tsx:27-33` |
| 18 | HIGH | **Sales CSV import has no idempotency** — re-import double-counts the one real-money surface | `sales/repository.ts:38-58` |
| 19 | MED | Revenue hero "available now ₪" = price × **assumed conversion gap** (estimate on intent) | `potential.ts:84-101` |
| 20 | MED | **Integrity Validator** checks only funnel ordering (orders≤opens) — blind to dup/inflation/spoof; shows `allPassed` | `queries.ts:357-378` |

*Also noted (MED/LOW): server trusts `occurred_at` within ±1 day (`route.ts:47-51`); session_id rotates after a 2h TTL mid-meal, double-counting guests (`session.ts:46-60`); "called waiter" funnel stage has no emitter → permanently 0 (`taxonomy.ts:31-37`); presentational confidence % is a fixed lookup `{58,74,91}` (`actions.ts:48`); recommendation created/executed state is localStorage-only, so there is no server anchor to attribute against (`actions/page.tsx:49,65-98`); all analytics reads `catch ⇒ empty/zero`, so a query failure looks like "no wins / 0 revenue" (`queries.ts:106,260,327,386`).*

## 7. Top 20 recommended fixes (in order)

1. **Stop calling intent "sales."** Rename every consumer of `order_completed` totals to "Purchase intent / potential"; remove the "Actual sales / Real measured revenue" caption until a real sale exists.
2. **Integrate a POS/orders source** as the *only* input to any "revenue/sales/proven" surface. No POS ⇒ no revenue claim.
3. **Recompute money server-side**: `revenue = clamp(qty) × serverPrice(slug)`, profit from server economics; ignore client `metadata.revenue/profit`.
4. **Authenticate + rate-limit `/api/track`** (per-tenant write token); never trust client `session_id` for a money path.
5. **Idempotency:** mint client `event_id` (uuid) at enqueue; add UNIQUE constraint; `insert … on conflict do nothing`.
6. **Persist the queue** to localStorage; remove entries only after a confirmed 2xx; drain on next load (true offline queue).
7. **One unload path** (pagehide) or an in-flight guard to stop double-flush.
8. **Add a real test before "success":** two-proportion z-test / Wilson lower-bound > 0, and a minimum absolute delta.
9. **Zero baseline ⇒ insufficient_data / "new signal"**, never auto-success; never render `deltaPct=null` as "+0%".
10. **Difference-in-differences** with a control (unchanged comparable items or matched day-of-week prior); guard overlapping changes on the same slug.
11. **Freeze closed-loop results** at window close (status, window, before/after, deltaPct, confidence) and make the first terminal result immutable.
12. **Move measurement to a cron** that evaluates once the window matures; the UI reads stored results.
13. **Gate every rate** on a minimum denominator (≥ 20–30 distinct sessions) and show "Not enough data" otherwise.
14. **Apply the `signals.ts` readiness gate** (n≥500, 95% coverage, 7 ready days) as a hard precondition for Revenue Center / Hall of Wins / Opportunities.
15. **Key history by stable `cocktail_id` FK**, not mutable slug; freeze a slug↔id map so rename/delete doesn't split history.
16. **One canonical sales source** feeding `estimatePotential` (real POS units) so the ₪ and the evidence agree.
17. **Flag profit as estimated** whenever cost falls back to `COCKTAIL_COST`; suppress/asterisk in UI.
18. **Remove Executive hardcoded floors/magic numbers**; reuse `estimatePotential` and drop the fabricated "confidence %".
19. **Idempotent Sales import:** unique `(restaurant_id, slug, period)` + upsert (or delete-then-insert the period).
20. **Distinguish "query failed" from "no data"** in every read path; add raw-row invariants to the Integrity Validator (dup detection, `0 ≤ revenue ≤ qty×maxPrice`, qty cap); bucket trends by **server-received** time.

## 8. Can it honestly prove revenue impact?

**No — not today, for any of its revenue/sales/"proven win" claims.** The chain breaks at the source
(intent, not a sale), the value (client-set, spoofable, duplicable), the comparison (no control, no
significance), and the lifecycle (live, non-monotonic, no frozen result). What it *can* honestly show is
**engagement**: which items get seen, opened, and explored (distinct-session funnel) — and even that is
inflatable via the open ingestion endpoint until fixes #4–#5 land.

**Minimum bar to make "this action improved sales" defensible:** a real POS feed (fix #2), server-trusted
& idempotent ingestion (#3–#5), a frozen difference-in-differences measurement with a significance gate
and the readiness gate applied (#8–#14), and honest labels everywhere intent ≠ sales (#1).
