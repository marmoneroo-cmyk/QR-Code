# Production Readiness Sprint — AI Menu Optimization

**Grounding:** every ticket maps to a finding empirically reproduced in
[`validation-audit.md`](validation-audit.md) (status in **bold**) and traced in
[`analytics-trust-audit.md`](analytics-trust-audit.md). The validation harness (`scripts/audit/`) is the
**acceptance gate**: a ticket is Done when its reproduction test no longer reproduces.

## Product vision (owner-set — supersedes the audit's framing)

The product is **AI Menu Optimization** — NOT "Google Analytics for restaurants." It understands guest
behavior, **identifies opportunities in the menu, and proposes actions to improve a dish's performance.**
The audit is technically right that the system cannot prove *sales* — but **sales was never the KPI.** The
KPI is:

> *Did the change I made to a dish make MORE guests interested in it / show ordering intent?*

### The metric ladder (the only metrics — no "Revenue", no generic "Engagement")
1. **Reach** — impressions (a guest saw the dish).
2. **Guest Interest** — opens, ingredient/video/AR explores, dwell. *(Passive: necessary, not sufficient — 500 opens with no next step does not make an owner happy.)*
3. **Ordering Intent** — "I want this" / add-to-favorites / flag-the-waiter / scan-another-QR. *(The business-meaningful signal — always labeled **intent**, never a sale.)*

**Menu Optimization = did a change move guests UP this ladder (especially into Ordering Intent).**

### Principles
- **Rename, don't delete.** Reframe screens toward menu-performance language; do **not** remove the Revenue
  Center / House Performance / AI Coach / Hall of Wins.
- **No sales attribution.** "Sales/Revenue" wording is allowed only on the imported-POS surface, clearly separated.
- **Security & data integrity BEFORE any branding.** What decides 1-vs-1000 restaurants is Auth, Tenant
  Isolation, Idempotency, Queue and Data consistency — not the screen names. Vocabulary changes come last.

## Definition of "Production Ready" (exit gate)

1. `/admin/*` and every `/api/*` require a valid session; tenant is **session-derived**, never `?restaurant=`.
2. `scripts/audit` re-run: **T1**→1 row (not 3), **T5**→no false win, **T8**→cross-tenant read = 401, **T3**→guest = visitor_id.
3. Owner surfaces use ladder vocabulary (Menu Performance / Guest Interest / Ordering Intent / Verified Improvement); "Sales/Revenue" appears only on the imported-POS surface.
4. A failed event POST is retried and never silently dropped; duplicate delivery is de-duped server-side.
5. Secrets rotated; service-role no longer used for tenant CRUD.
6. **Menu Performance is formally defined** ([`ordering-intent-spec.md`](ordering-intent-spec.md)); every engagement level emits (no metric on a dead event); the **funnel shape** (stage-conversion rates, highest-rung-per-session) is the dish KPI — **no hard-coded score weights**.
7. The **AI recommendation suite** (20–30 scenarios) passes its precision gate with **0 false positives** below threshold.

---

## EPIC A — Authentication *(unblocks B & F authz; do first)*
| # | Ticket | Owner | Evidence |
|---|---|---|---|
| A1 | Enable Supabase email auth; create owner/manager/staff users | **YOU** (dashboard) | `ACTIVATE-AUTH.md` |
| A2 | Flip `AUTH_ENFORCED=true`; verify proxy gates `/admin/*` | code✓+**YOU** | proxy.ts shipped |
| A3 | Add session check to every `/api/*` route (reads + writes) | code | T8/T9 no-auth **CONFIRMED** |
| A4 | Derive tenant from `getSessionContext()`, drop `?restaurant=`/`body.restaurant` defaults | code | T8 cross-tenant **CONFIRMED** |
| A5 | Rotate exposed secrets (service_role, pollinations sk_) | **YOU** | `SECURITY-rotate-secrets.md` |

## EPIC B — Multi-tenant security *(depends A)*
| # | Ticket | Owner | Evidence |
|---|---|---|---|
| B1 | Stop service-role for tenant CRUD; use cookie-bound anon client so **RLS is the live boundary** | code | foundation freeze |
| B2 | Audit + repair RLS on `events`/`changes`/`promotions`/`experience`/`sales` (anon read already blocked — keep it) | code/migration | T8 anon read=0 **NOT REPRODUCED (good)** |
| B3 | Close cross-tenant authz leak on `/api/changes,/sales,/experience,/promotions` (`?restaurant=` no auth) | code | T8 **CONFIRMED LEAK** |
| B4 | Per-tenant write token **or** session auth on `/api/track` (fully open today) | code | T9 **CONFIRMED** |

## EPIC C — Event integrity (idempotency)
| # | Ticket | Owner | Evidence |
|---|---|---|---|
| C1 | Mint client `event_id` (uuid) per event + server `upsert … on conflict do nothing` — **✅ done + verified live** (stamps land; graceful pre-migration fallback) | code ✅ | T1 CONFIRMED |
| C2 | Apply migration **`0008_event_idempotency.sql`** (`events.event_id` + unique index) — **then dedupe activates automatically, no redeploy** | **YOU apply** | T1 CONFIRMED |
| C3 | Acceptance: after 0008, POST same `eventId` 3× → **1 row** | gate | — |
| C4 | **`eventVersion` + `eventSource`** stamped on every event (schema versioning + QR/AR/kiosk attribution) — **✅ done + verified live** | code ✅ | — |

## EPIC D — Queue reliability
| # | Ticket | Owner | Evidence |
|---|---|---|---|
| D1 | Persist queue to localStorage; remove only after a confirmed 2xx; drain on load — **✅ done** | code ✅ | T2 CONFIRMED |
| D2 | Retry w/ backoff; re-flush on `online`; `sendBeacon` on unload (kept persisted → idempotency de-dupes) — **✅ done** | code ✅ | tracking-3/4 |
| D3 | No silent failures — a non-2xx / network error KEEPS events (never dropped) — **✅ done** | code ✅ | integrity-2 |
| D4 | Acceptance: failed send retains + retries; with C ⇒ at-least-once delivery, exactly-once effect | gate | — |

## EPIC E — Data consistency
| # | Ticket | Owner | Evidence |
|---|---|---|---|
| E1 | Aggregate by stable `cocktail_id` FK, not mutable slug | code+migration | integrity-3 |
| E2 | Bucket trends by **server-received** time; clamp `occurred_at` (no future, small negative only) | code | T9 ±1d **CONFIRMED** |
| E3 | Use `visitor_id` for "guests"/denominators; repair sessionStorage-vs-localStorage impressed-set split | code | T3 **CONFIRMED** |
| E4 | Fix the stale session doc-comment (says sessionStorage; code uses localStorage) | code | T3 |
| E5 | Discriminate "query failed" vs "no data" in all reads (no `catch ⇒ empty`) | code | integrity-6 |

## EPIC F — Analytics correctness (honest measurement)
| # | Ticket | Owner | Evidence |
|---|---|---|---|
| **F1** | **Kill the false-win generator** in `measure.ts`: require full equal window; zero/tiny baseline → insufficient_data; min absolute delta | code+tests | **T5 CONFIRMED** — *started this turn* |
| F2 | Freeze closed-loop result at window close (persist status/window/before/after/delta); first terminal result immutable; provisional vs final labels | code+migration | closedloop-1/3 |
| F3 | Scheduled measurement job (cron) once window matures; UI reads stored result | **YOU**(cron)/code | closedloop-2 |
| F4 | Hide any rate whose denominator < ~25 distinct sessions → "Not enough data yet" | code | statistical-3 |
| F5 | Apply the existing `signals.ts` readiness gate (n≥500, 95% coverage, 7 ready days) as a precondition for owner-facing engine claims | code | statistical-6 |
| F6 | One confidence derived from sample size; delete the fixed `{58,74,91}` lookup | code | briefing-5 |

## EPIC G — Menu-Optimization vocabulary (RENAME, not delete) *(LAST — after Security + Measurement)*
**Do not delete any screen.** Keep Revenue Center, House Performance, AI Coach, Hall of Wins — rename them
toward menu performance, and surface **Ordering Intent** as the top of the ladder (never "sales/revenue").
| # | From → To | Owner |
|---|---|---|
| G1 | **Revenue Center → Menu Performance Center** | code |
| G2 | **Revenue Opportunity → Opportunity Score** | code |
| G3 | **Revenue Impact → Expected Menu Impact** | code |
| G4 | **Win → Verified Improvement** (Hall of Wins kept, wins = verified menu improvements) | code |
| G5 | Money figures (`₪ upside`, totals) → **Opportunity Score / Expected Menu Impact** (Interest + Ordering-Intent based), never "Revenue"; Executive "Projected ₪/mo" → an interest-based **Opportunity Score** (drop the hardcoded floors) | code |
| G6 | Keep "Sales/Revenue" wording **only** on the imported-POS `sales` surface (clearly separated); add idempotent import | code+migration |
| G7 | Lint/test guard: owner copy must use the ladder vocabulary (Reach / Guest Interest / Ordering Intent / Menu Performance), not "Revenue" or bare "Engagement" | code |

## EPIC H — Menu Performance & Intent *(define the KPI before building on it)*
Wire the **5-layer ladder** (Reach → Interest → **High Interest** → Ordering Intent → Verified Improvement)
per [`ordering-intent-spec.md`](ordering-intent-spec.md). Today the closed-loop `intent` metric counts
`cocktail_favorited`, which **never emits** (KPI on a dead event), and the decisive **High Interest** rung
(video-completed, AR-duration, revisits) isn't instrumented at all.
> **GOLDEN RULE — Collect first, interpret later.** Most AI products rush to conclusions. We do the
> opposite: build the data lake now, interpret only once the data is trustworthy. Epic H therefore splits.

### H-A — Instrumentation *(START NOW — additive raw collection; no scoring, no AI, no UI judgement; changes no existing behavior)*
Store **raw signals, not conclusions**. Rides the same pipeline as today (so it inherits its loss/dup until
C+D land — directional, not perfect; that's fine, nothing interprets it yet).
| # | Ticket | Owner |
|---|---|---|
| HA1 | **Video progress:** `cocktail_video_progress`, value = max watched % (0–100), emitted on end/leave | code |
| HA2 | **AR dwell:** `cocktail_ar_dwell`, value = seconds of AR open | code |
| HA3 | **Scroll depth in the dish page** — confirm `cocktail_scroll_depth` covers the experience (extend if not) | code |
| HA4 | **Auto-derived "Your Favorites"** at the menu foot (from dwell/video/AR/revisits — zero clicks) → emits `cocktail_favorited`; optional ❤ Save later. **`call_waiter` removed from the model.** *Deferred: UI comes after security; never pollute the cinematic UX for analytics.* | code (later) |
| HA→ | **Time-to-first-interaction, Exit-point, Revisit-count, Session-depth are DERIVED** from the raw timeline (timestamps + session_id already captured) — computed in H-B, not emitted as new events | note |
| HA5 | **Segment every event** — stamp `restaurantType` + `menuCategory` (server-derived) into metadata so future per-segment threshold-learning is possible; backfilling is impossible. **✅ done + verified live** | code ✅ |
| HA✓ | Acceptance: each new raw event lands in `events`; **nothing scores/interprets it**; existing menu behavior unchanged | gate |

### H-B — Interpretation *(DO NOT START until Sprint 1 + 2 are done)*
Depends on Auth · Tenant Isolation · Queue Reliability · Data Integrity · Honest Measurement — otherwise the
AI reasons over data you cannot trust.
| # | Ticket | Owner |
|---|---|---|
| HB1 | One module = the ladder + the **funnel shape** (stage-conversion rates) + the highest-rung-per-session law. **No hard-coded weights** | code |
| HB2 | Derive revisits · session-depth · time-to-first-interaction · exit-shape from the raw timeline | code |
| HB3 | **Honest labels:** `add_to_order_clicked`→"Wants this", `order_completed`→"Ready to order" (closed loop never calls these a sale) | code |
| HB4 | Closed loop / opportunities / wins consume the **funnel shape**, not raw favorites+orders | code |
| HB5 | Owner UI: 5-layer funnel + stage drop-offs + per-layer deltas ("Verified Improvement"); any single score is indicative-only | code |
| HB→ | **Deferred (post-data):** once real multi-restaurant behavior exists, *learn* which patterns predict a "working" vs "non-working" dish — only then a weighted Menu Performance Score | future |

## EPIC I — AI Recommendation Validation *(the recommendation IS the product — not the UI/AR/dashboard)*
> **PULLED FORWARD (owner direction) & PARTLY BUILT — runs parallel to Sprint 1 since it's pure logic.**
> The funnel-shape AI Coach **brain** ships: `src/lib/menu-intel/funnel.ts` (`diagnoseFunnel` — reads the
> SHAPE, names the bottleneck) + **50 synthetic scenarios** (`scenarios.ts`, growing → 100) + the validation suite
> (`funnel.test.ts`, **162 tests green**, incl. Aperol→`weak_conversion`, Truffle Burger→`exposure_gap`).
> Each verdict now carries **diagnosis confidence** (sample-size + separation; same shape at reach 50 vs 50k →
> different confidence) and an **evidence array**; cut-points are externalized in **`thresholds.ts`** (per-category, tunable).
> Remaining: precision/recall metrics + CI gate (I4), and wiring it to **real** funnels (that wiring is H-B,
> gated behind Sprint 1+2 — never run it on untrusted data).

| # | Ticket | Owner |
|---|---|---|
| I1 | Reconstitute the audit harness as a **test-only** endpoint; build a **20–30 synthetic-scenario** suite (known event distribution → expected recommendation) | code |
| I2 | Cover the canonical funnel diagnoses: **high reach+interest, low intent** → price/description/position · **low open, high intent** → exposure problem · **low open, low intent** → new image · plus high-AR/low-intent · high-intent/low-revisit · all-zero · below-threshold | code |
| I3 | Assert each returns the EXPECTED opportunity type AND fires **nothing** below the data threshold | code |
| I4 | Compute precision/recall across the suite; gate in CI; catch regressions | code |
| I✓ | Acceptance: ≥ target precision; **0 false positives** on below-threshold inputs | gate |

---

## Sequencing (owner order — security & AI accuracy before branding)
- **Phase 0 — YOU (unblocks everything):** enable Supabase email auth + users · rotate exposed secrets · prep migrations. *Additive instrumentation H1–H3 may also start now (low-risk) so real intent data accrues before it's measured.*
- **1 — A + B** Authentication + Multi-tenant security. *If 100 restaurants arrive, what kills you is leakage/auth, not AI.*
- **2 — C + D (+E)** Idempotency + Queue persistence + data-consistency.
- **3 — F** Honest measurement. *(F1 done + tested, parked — ships here.)*
- **4 — H** Intent Validation — wire & score the ladder. **Highest product risk if skipped: the KPI is currently undefined / built on a dead event.**
- **5 — I** AI Recommendation Validation — 20–30 scenarios, precision + false-positive gate.
- **6 — G (last)** Vocabulary rename. Renaming adds zero customers; security, reliability and AI accuracy do.

## Acceptance / regression gate
Keep `scripts/audit/run.js` as a CI integrity suite (re-add the harness route as a **test-only, auth-gated**
endpoint, not the dev shim that was deleted). Each epic's "Acceptance" row must pass before the epic closes.
