---
name: feedback-menu-optimization-vision
description: "The analytics product is \"AI Menu Optimization\" (not behavior analytics); reframe = rename-not-delete; security before branding"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 863cfba6-3fbc-44be-a19e-ca0befc42724
---

The owner corrected my post-audit framing: the analytics side of the product is **AI Menu Optimization**,
NOT "Guest Behavior Analytics / Google Analytics for restaurants." The two trust audits are technically
right that the system cannot prove **sales** — but **sales was never the KPI.** The real KPI:

> "Did the change I made to a dish make MORE guests interested in it / show ordering intent?"

**Metric ladder (the only vocabulary — never "Revenue", never generic "Engagement"):**
Reach (impressions) → Guest Interest (opens, video/AR/ingredient explores, dwell — passive, necessary not
sufficient) → **Ordering Intent** ("I want this" / favorite / flag-waiter / scan-another-QR — the
business-meaningful signal, labeled *intent*, never a sale). Optimization = did a change move guests UP
the ladder.

**Why:** I let a *technical* audit ("can't prove sales") drift into a *product* decision ("strip it to
behavior analytics / delete revenue screens"). That nearly changed the product DNA. The audit informs
honesty fixes; it does not set product vision.

**How to apply:**
- The reframe is a **RENAME, not a deletion.** Do NOT delete Revenue Center / House Performance / AI Coach
  / Hall of Wins. Rename: Revenue Center→**Menu Performance Center**, Revenue Opportunity→**Opportunity
  Score**, Revenue Impact→**Expected Menu Impact**, Win→**Verified Improvement**. "Sales/Revenue" wording
  only on the imported-POS surface.
- **Sequencing is fixed:** Security + Multi-tenant + Idempotency + Queue + Data integrity come FIRST
  (decides 1-vs-1000 restaurants); honest measurement (closed loop / wins / stats) second; vocabulary
  rename LAST. Do not touch branding before security.
- **KPI = the funnel SHAPE, not a weighted score.** 5-layer ladder (`ordering-intent-spec.md` v3):
  **Reach → Interest → High Interest → Ordering Intent → Verified Improvement**; one session counted once at
  its **highest rung** (system law). The metric is the stage-conversion rates (e.g. "84% reach interest,
  only 2% continue to intent"); the AI Coach diagnoses the drop-off. **Do NOT hard-code score weights** — a
  single Menu Performance Score is DEFERRED until weights can be *learned* from real multi-restaurant data.
- **Instrument every level (don't collapse):** video as `cocktail_video_progress` (value=max %) → Started/
  50%/Completed; AR as `cocktail_ar_dwell` (value=sec) → Started/Engaged≥5s/Deep≥15s; cut-points derived
  from the value, re-tunable without re-instrumenting. High Interest (video≥50%, AR deep, viewed≥3×) not
  wired yet (Epic H).
- **GOTCHA:** the closed-loop `intent` metric = `['cocktail_favorited','order_completed']`, but
  `cocktail_favorited` **never emits** (the favorites UI was deleted) — so "intent" is silently just
  order_completed. Don't trust intent numbers until Epic H wires the ladder. Same for `call_waiter_clicked`
  / `cocktail_shared` (declared, dead). Also: `order_completed` is mislabeled "Order placed / הזמנה בוצעה"
  but there is no POS/sale — relabel `order_completed`→"Ready to order", `add_to_order_clicked`→"Wants this"
  (label-only, DB event names unchanged).
- **Sprint order (owner-set):** A+B (auth+tenant) → C+D (idempotency+queue) → F (measurement) → H (intent
  validation) → I (AI-recommendation validation, 20–30 synthetic scenarios) → G (rename, last).
- **Don't pollute the cinematic UX for analytics — no tracking buttons.** `call_waiter` removed from the model.
  Favorites is **auto-derived** ("Your Favorites" from dwell/video/AR/revisits), optional ❤ Save only (deferred,
  UI after security).
- **AI Coach brain BUILT + tested** (`src/lib/menu-intel/funnel.ts`, `scenarios.ts`, `thresholds.ts`): `diagnoseFunnel`
  reads the funnel shape → one diagnosis, now with **confidence** (sample-size + separation; same shape at reach
  50 vs 50k → different confidence) + **evidence array**. Cut-points externalized in `thresholds.ts` (per-category,
  tunable — never hard-coded weights). 50 scenarios, 162 tests. Pure logic, NOT wired to prod yet (H-B, gated).
- Full plan: `docs/saas-foundation/production-readiness-sprint.md`; evidence in `analytics-trust-audit.md`
  + `validation-audit.md`. F1 (false-win fix) is done + parked.
