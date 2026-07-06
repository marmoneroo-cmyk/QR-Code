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

### Architecture — the three knowledge layers (the model behind the WHOLE platform)
Three things people conflate, kept strictly separate. Almost every epic drops cleanly into one:

| Layer | What it is | Contains | Where most stop |
|---|---|---|---|
| **① Reality** | what guests *actually did* — facts, no AI, no interpretation | Events · Queue · Idempotency · Segments · `menu_version` · Seasonal (Epics C/D/H-A + J5/J9) | most products stop here |
| **② Intelligence** | what the system *thought* — a hypothesis about reality, never reality itself | AI Coach · diagnosis · confidence · evidence · threshold profiles · provenance (Epic I + J2/J3.5) | good AI products reach here |
| **③ Learning** | what the world *taught* the AI once the hypothesis met reality | Recommendation/Outcome/Counterfactual ledgers · lifecycle · override · negative knowledge · Knowledge Health (J4–J13) | **very few reach — this is the moat** |

**Why ③ outranks engine accuracy:** the chain `good Reality → WRONG Intelligence → excellent Learning` still
*compounds* — an engine wrong 50% of the time today keeps improving as long as Layer ③ faithfully records what
happened after each hypothesis. A sound learning layer beats a clever engine. The dependency also runs the bad
way (`bad Reality → bad Intelligence → bad Learning`) — which is precisely why Reality infrastructure + Security
(Sprint 1, then A5) come first, before the engine is ever trusted.

**The moat is not AR, not the menu, not even the recommendation engine** — it is the accumulated knowledge
linking *what guests did → what the AI thought → what actually happened next*, near-impossible to copy once it
has compounded for years. So the most important company metric becomes **Knowledge Health** (recommendations
generated / implemented / verified / failed; new knowledge accrued) — not restaurant count or event volume.

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
| A1 | Enable Supabase email auth; create owner user — **✅ done** (user `34dc7f5e…`, email-confirmed) | **YOU** ✅ | dashboard |
| A2 | Flip `AUTH_ENFORCED=true`; proxy gates `/admin/*` — **✅ done + live in prod** (`/admin` → 307 `/admin/login`) | code ✅ · YOU ✅ | prod probe |
| A3 | `requireSession()` guard on every admin `/api/*` (reads + writes) — **✅ done + live-verified**: logged-out → **401** on all guarded routes; public menu (`promotions`/`experience` GET, `recommendations`) + `track` still **200** | code ✅ | `verify_auth_guard.js` **13/13** |
| A4 | Tenant from `getSessionContext()`; drop `?restaurant=`/`body.restaurant` on writes — **✅ done + live** | code ✅ | T8 leak → **closed** |
| A5 | Rotate exposed secrets (service_role, pollinations sk_) | **⏳ YOU** | `SECURITY-rotate-secrets.md` |

## EPIC B — Multi-tenant security *(depends A)*
| # | Ticket | Owner | Evidence |
|---|---|---|---|
| B1 | Stop service-role for tenant CRUD; user-scoped (cookie-bound anon) client on promotions/sales/changes/experience so **RLS is the live boundary** — **✅ done** (repos take an optional `db`; writes+reads pass the user-scoped client) | code ✅ | RLS enforced |
| B2 | Migration **`0011_membership_seed.sql`** — seeds owner→`diner` membership (prod `restaurant_members` was **EMPTY**, verified) + re-asserts RLS on 8 tables. **Mandatory before A2 or lockout.** | code ✅ · **⏳ YOU apply** | 0011 |
| B3 | Close cross-tenant authz leak on `/api/{promotions,sales,changes,experience}` (`?restaurant=` write, no auth) — **✅ done + live-verified** | code ✅ | T8 leak → **closed** |
| B4 | `/api/track` stays public + service-role by design (anonymous diners); per-tenant write token = later hardening | defer | — |
| **B5** | **HARD GATE before tenant #2:** session-scope the analytics **READ** functions that still default `'diner'` (`getCrmSignals`/`getExecutiveSummary`/`getMenuSignals`/overview/heatmap/journeys/integrity/raw/signals/experiments). They are **auth-gated now** (no anonymous read) but **not yet tenant-isolated** — *single-tenant-safe today*, would serve `diner`'s data to a 2nd tenant's user. Must land before onboarding tenant #2. | code (follow-up) | sec-review **H3** |

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
| **F1** | **Kill the false-win generator** in `measure.ts`: full equal window else `too_early`; zero/tiny baseline → `insufficient_data`; min absolute delta — **✅ done + shipped**. 5-status engine wired end-to-end (types → server confidence → closed-loop UI labels); 10 tests. | code+tests ✅ | **T5 CONFIRMED → fixed** |
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
> (`funnel.test.ts`, **167 tests green**, incl. Aperol→`weak_conversion`, Truffle Burger→`exposure_gap`).
> Each verdict now carries **diagnosis confidence** (sample-size + separation; same shape at reach 50 vs 50k →
> different confidence), an **evidence array**, and a full **provenance envelope** (engine/profile version +
> frozen evidence snapshot + content-addressed id — see Epic J); cut-points are externalized in
> **`thresholds.ts`** (per-category, tunable).
> Remaining: precision/recall metrics + CI gate (I4), and wiring it to **real** funnels (that wiring is H-B,
> gated behind Sprint 1+2 — never run it on untrusted data).

| # | Ticket | Owner |
|---|---|---|
| I1 | Reconstitute the audit harness as a **test-only** endpoint; build a **20–30 synthetic-scenario** suite (known event distribution → expected recommendation) | code |
| I2 | Cover the canonical funnel diagnoses: **high reach+interest, low intent** → price/description/position · **low open, high intent** → exposure problem · **low open, low intent** → new image · plus high-AR/low-intent · high-intent/low-revisit · all-zero · below-threshold | code |
| I3 | Assert each returns the EXPECTED opportunity type AND fires **nothing** below the data threshold | code |
| I4 | Compute precision/recall across the suite; gate in CI; catch regressions | code |
| I✓ | Acceptance: ≥ target precision; **0 false positives** on below-threshold inputs | gate |

## EPIC J — Data Provenance & Platform Health *(metadata > algorithm — cheap now, impossible to backfill)*
> **Owner direction:** before scaling the AI, make every conclusion *traceable* and prove the
> *platform itself* is healthy before trusting any per-restaurant read. Provenance is metadata, not a
> tenant feature → **inside** the Foundation Freeze, not blocked by it. Two pieces shipped now while the
> pipeline is young; the dashboard is sequenced at its proper slot (after Auth + Isolation).
>
> **THE THREE KNOWLEDGE LAYERS (owner's synthesis — the conceptual model behind all of Epic J):**
> **① Reality — what guests did:** the event stream + its stamps — segmentation, `eventVersion`/`eventSource` (C4), `uiVersion` (J1), `menu_version` (J5), seasonal (J9). *Most products stop here.*
> **② Hypothesis — what the AI thought:** J2 provenance envelope · J3.5 lineage · J4 recommendation ledger · J6 as-of-then context. *Good AI products reach here.*
> **③ Learning — what the world taught the AI:** J4.5 outcome · J4.6 lifecycle · J7 exposure · J8 override · J10 resolution · J11 confounding · J12 negative knowledge · J13 counterfactual. ***Very few systems reach Layer ③ — and it IS the competitive moat.*** Note where the weight sits: most of Epic J lives in Layer ③, the hard and valuable one.
| # | Ticket | Owner | Evidence |
|---|---|---|---|
| J1 | **`uiVersion`** stamped on every event's metadata (version of the *rendered experience* — image/video/AR/UX) so a future UX change can't be mistaken for a change in the dish — **✅ done** (`UI_VERSION` in taxonomy, stamped in `track.ts`) | code ✅ | tsc+build green |
| J2 | **Recommendation provenance envelope** — every `diagnoseFunnel` verdict carries `{ recommendationId, engineVersion, thresholdProfile, confidence, evidenceSnapshot }`. `recommendationId` is content-addressed (FNV-1a, deterministic — no clock/random) so an unchanged verdict keeps its id and a changed one gets a new one. `ENGINE_VERSION='3.0'`; profiles `default_v1`/`cocktail_v1` — **✅ done + tested** (11 new cases, 167 green) | code ✅ | funnel.test.ts |
| J3 | **Dataset Health Dashboard (Super-Admin only — internal, NOT owner-facing).** A *brutal operational screen*, not a pretty one. **Platform Health:** Events Today/24h · Active vs Silent Restaurants · Failed Events · **Duplicate Rate** (conflicts/inserts, from C/0008) · **Queue Retry Rate** · Queue Backlog. **Data Quality:** missing `restaurantType`/`menuCategory`/`eventSource`/`uiVersion` · Unknown event types. **AI Readiness:** restaurants/dishes above vs below the data threshold · dishes eligible for AI recs. **Security:** failed logins · unauthorized API attempts · cross-tenant violations · expired sessions. **Knowledge Health** *(the one that matters most in 2 years — not "how many events?" but "how much trustworthy knowledge accumulated?")*: Recommendations Generated / Implemented / Verified / Rejected · Negative Outcomes · Confounded Outcomes · **Learning Coverage** = % of recommendations that reached a *terminal* state (verified-improvement OR confirmed-negative) vs stuck unmeasured. *Prove the platform is healthy before analysing any restaurant.* **Needs Auth + super_admin role first; do NOT build owner-less admin UI before B.** | code | owner spec |
| J3.5 | **Data Lineage** — every recommendation must be **reproducible from stored state**, not just its text. Persist alongside each verdict: engine version · threshold profile · **dataset snapshot** (event-count + date-range + a data-version/hash of what it was computed over) · funnel shape · confidence · evidence. (Durable, queryable extension of J2's in-memory envelope — satisfied by the J4 table.) *Owner: in a year, "why did you tell me to swap the Negroni photo?" must be answerable from the record.* | code | owner direction |
| J4 | **Recommendation Ledger** *(persistent — prerequisite for H-B)* — persist every recommendation as a row `{recommendation_id, restaurant_id, dish_id, engine_version, diagnosis, confidence, evidence, created_at, status}` carrying its full J3.5 lineage. **Owner: at 100 restaurants the biggest asset isn't customer data — it's the history of what the AI advised and the measured result; that's the training set for a smarter engine.** = migration + write-on-generate. | code (migration+code) | owner direction |
| J4.5 | **Outcome Ledger** — capture what the restaurant **actually did**, separate from what was advised: `{recommendation_id, action_taken, taken_at, taken_by}` + measured result `{outcome, measured_at, delta_interest, delta_intent}`. Without it you can't distinguish *recommended-but-ignored* from *recommended-and-done* — the single most important split for learning which advice works. | code | owner direction |
| J4.6 | **Recommendation Lifecycle** — status machine per recommendation: `created → viewed → accepted → implemented → measured → verified → archived`. Sounds bureaucratic; it's exactly what lets you later answer *"of 10,000 recommendations, how many were implemented — and of those, how many verified an improvement?"* | code | owner direction |
| J5 | **Menu Versioning** *(same can't-backfill class as J1 `uiVersion` / C4 `eventVersion` — wire the stamp at the START of this work)* — a `menu_version` per dish that **bumps on any change to image / price / description / position**, stamped onto every event. Without it you can't attribute a funnel to a dish *version*, or know which change caused which improvement. Stamping now is cheap; reconstructing it later is impossible. | code | owner direction |
| J6 | **Restaurant Lifecycle Snapshot** — freeze temporal context on each recommendation: `restaurant_age_days`, `days_since_menu_change`, `days_since_last_ai_recommendation`, `days_since_last_verified_improvement`. *A 2-week-old venue behaves nothing like a 4-year-old one; some advice will prove to work only for "young" vs "mature" restaurants.* **Backfill-risk: LOW** — derivable from stored timestamps (restaurant.created_at · J5 menu-change ts · J4 ledger · J4.5 outcomes); this is a *freeze-for-convenience* (lock the as-of-then context, avoid historical recompute), not strictly un-backfillable. | code | owner direction |
| J7 | **Recommendation Exposure** — the granular front-half of the J4.6 lifecycle: `created → viewed → opened → (dwell ms) → accepted → implemented → measured`. Did the owner even SEE it? how long did they read it? did they open details, or ignore it? *This is how you learn which recommendations actually persuade action.* **Backfill-risk: HIGH — truly un-backfillable** (you can never later know if a past rec was seen). Requires instrumenting the owner-facing recommendation UI → rides with H-B (the coach screen). | code | owner direction |
| J8 | **Human Override Tracking** — extends J4.5: record the AI's suggestion next to what the owner did, so an override is detectable: `{recommendation_id, ai_action, human_action}` (override = `human_action ≠ ai_action`). *One of the strongest learning signals — sometimes the human knows something the model doesn't yet.* **Backfill-risk: HIGH** — capture at action time. | code | owner direction |
| J9 | **Seasonal Context** — stamp `{season, month, weekday, hour_bucket}` on every event (Aperol→summer · Irish Coffee→winter · desserts→evening). **Backfill-risk: LOW–MED** — re-derivable from the stored `occurred_at`, *except* guest-local time (server stores UTC); so store the restaurant timezone once + stamp the bucket at write-time to kill TZ ambiguity. Cheap server-side add in `/api/track` (same spot as the segment stamps). | code | owner direction |
| J10 | **Recommendation Resolution** — the missing **Owner-Interpretation** layer between advice and action: the same `action_taken = change_image` can be a pro lighting/angle shoot OR a blurry phone snap — *two opposite experiments logged identically*. Capture `{implementation_quality, implementation_notes, before_asset_version, after_asset_version}` so the future question isn't "did changing the image work?" but **"which KIND of change worked?"** *Rigor:* lean on **objective** before/after signals (asset resolution/sharpness, pro-vs-stock, the J5 asset/`menu_version`) — self-rated quality is weak and inflated; store the objective deltas and cluster "quality" later. Extends J5. **Backfill-risk: HIGH.** | code | owner direction |
| J11 | **Recommendation Competition (concurrent-change attribution)** — restaurants don't make one change: image (day 1) + price (day 3) + menu-position (day 5) → Intent +40%. *Who gets the credit?* Capture `{change_id, implemented_at, active_experiments:[…]}` so every measurement window records what ELSE was live. *Rigor:* this is a **refinement to Epic F** — a closed-loop delta measured during overlapping changes is **confounded** and must be flagged, not reported as a clean win; credit-assignment is a future modeling problem but **impossible without the timeline captured now**. The `changes` table already timestamps changes — J11 adds the concurrency tagging. **Backfill-risk: HIGH.** | code | owner direction |
| J12 | **Negative Knowledge Ledger** *(owner: maybe the most important item in all of Epic J)* — most AI systems store wins; the edge is in **failures**: 800 restaurants told "add a video" → didn't work, didn't work, didn't work… is *more valuable than the successes*. Record `{recommendation, outcome: negative\|null, confidence_before, confidence_after}`. *Rigor:* this is a **discipline, not just a table** — the J4/J4.5 ledger must persist negative AND null outcomes with **equal fidelity (zero survivorship bias)**, plus the confidence **prior→posterior** so you watch the engine's belief get corrected by reality. That prior→posterior delta IS the training signal. **Backfill-risk: HIGH.** | code | owner direction |
| J13 | **Counterfactual Ledger** *(Layer ③ — the control arm)* — capture what happened when a recommendation was **NOT implemented** (`{implemented:false, outcome:'improved_anyway'\|'no_change'}`) and when it **was implemented but didn't help** (`{implemented:true, outcome:'no_improvement'}`). *Rigor:* this is a **measurement discipline** — re-measure a dish's funnel after a recommendation **regardless of whether it was acted on** (don't only measure the wins), so 'improved-anyway' and 'implemented-but-flat' are observed. The gold standard (deliberately withhold a rec from a holdout to measure true lift) is a future experimental-design capability; the cheap-now part is *measure everything, not just the implemented ones*. One of the rarest, most causal signals. **Backfill-risk: HIGH.** | code | owner direction |
| J✓ | Acceptance: any recommendation reproducible from lineage (J3.5) + frozen lifecycle/seasonal context (J6/J9); the ledger records advice + resolution/interpretation (J10) + concurrency (J11) + outcome **incl. negatives, nulls & counterfactuals** (J4.5/J12/J13) + override + exposure + lifecycle (J4/J4.6/J7/J8); confidence prior→posterior captured (J12); every event carries `menu_version` (J5) + seasonal context (J9); the dashboard renders Platform/Data-Quality/AI-Readiness/Security/**Knowledge-Health** behind super-admin auth | gate | — |

> **Owner's value-to-AI ranking** (a *different axis* from the dependency-driven build order below): **J4 ▸ J4.5 ▸ J5 ▸ J7 exposure ▸ J8 override ▸ J9 seasonal ▸ J4.6 ▸ J3.** The surprise the owner named: **J3 (Dataset Health Dashboard) is first-seen but almost last in moat value.** The single highest-value asset in two years = *"a complete history of what the AI recommended, what the owner actually did, and what happened after"* — data almost no competitor holds.
>
> **Engineering refinement — *capture-now* vs *freeze-for-convenience*:** only **J7 (Exposure)** and **J8 (Override)** are *truly un-backfillable* — they record a moment (was it seen? what did the human do instead?) that is gone forever if not instrumented live, and both ride the owner recommendation UI (H-B). **J6 (lifecycle snapshot)** and **J9 (seasonal)** are *derivable from stored timestamps* (`occurred_at`, `created_at`, ledger ts) — valuable to freeze, but not urgent. Practical upshot: J9 is a trivial `/api/track` stamp whenever we resume the J-block; J7/J8 are the ones whose *timing* genuinely matters.
>
> **The mission, in one line (owner):** the goal is **not** a system that knows what's happening in a menu — it is a system that **accumulates, over years, causal knowledge of which actions improve which dishes, under which conditions, for which restaurant types, and at what confidence — including what *fails*.** That is no longer a menu product; it is an **organizational learning system for the restaurant industry**. J10 (how a change was actually executed) + J11 (what else was changing) + J12 (what didn't work) are the three pieces that turn raw outcomes into *causal* knowledge. **With J1–J12 the Epic-J data model is complete for that learning goal** — every kind of metadata that cannot be reconstructed later is now accounted for before the engine ever reasons over real data.

---

## Sequencing (owner order — security & AI accuracy before branding)
> **Done ahead of sequence (young-pipeline, can't-backfill metadata — inside the freeze):** C (idempotency
> client), D (queue), C4 (`eventVersion`/`eventSource`), HA5 (segmentation), **J1 (`uiVersion`)**, **J2
> (recommendation provenance)**. These protect the *data*, not a tenant feature — so they ran in parallel with Phase 0.
- **✅ Phase 0 + Sprint 1 DONE:** Supabase auth on · migrations 0007/0008/0011 applied · **A+B live in prod** (auth-enforced, session-derived tenant, RLS boundary, `?restaurant=` leak closed) · C+D (queue+idempotency) · J1/J2 (uiVersion + provenance envelope).
- **1 — A5 (NOW, before any new code):** rotate every exposed secret (service_role, Pollinations `sk_`, DB password; anon rotates with the JWT secret) → update Vercel → redeploy → verify login/track/admin. *A leaked service_role makes everything below pointless.*
- **2 — J3** **Dataset Health Dashboard** (super-admin, brutal operational screen): Platform Health · Data Quality (missing restaurantType/menuCategory/eventSource/uiVersion, unknown event types) · AI Readiness (restaurants/dishes above threshold) · Security (failed logins, unauthorized API attempts, cross-tenant violations). *Prove the platform is healthy before analysing any restaurant.*
- **3 — J4 (+J3.5 lineage)** Recommendation Ledger persisting full reproducible lineage. *The long-term training asset.*
- **4 — J4.5** Outcome Ledger — what the restaurant *actually did* + the measured result (recommended-but-ignored vs recommended-and-done).
- **5 — J4.6** Recommendation Lifecycle — created→…→verified→archived state machine.
- **6 — J5** Menu Versioning — `menu_version` bumped on dish image/price/description/position change, stamped on events. *Can't-backfill: wire the stamp first.*
- **7 — F** Honest measurement — **F1 ✅ shipped** (false-win killer live in prod); F2–F6 remain + **B5** (tenant-scope analytics reads before tenant #2).
- **8 — H-B + I** Wire & score the ladder on trusted data + AI Recommendation Validation. Each verdict persists to the J4 ledger with its J2/J3.5 lineage and accrues a J4.5 outcome.
- **9 — G (last)** Vocabulary rename. Renaming adds zero customers; security, reliability and AI accuracy do.
> **Why this whole J-block precedes H-B (owner):** the risk has shifted from *"will the product work"* to *"will the data be good enough in 6 months to be a moat."* The moment the engine runs on real data, anything not captured today is unrecoverable — lineage, outcomes, lifecycle and menu_version are the metadata that turns a nice product into a system that *learns* over years.

## Acceptance / regression gate
Keep `scripts/audit/run.js` as a CI integrity suite (re-add the harness route as a **test-only, auth-gated**
endpoint, not the dev shim that was deleted). Each epic's "Acceptance" row must pass before the epic closes.
