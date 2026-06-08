# Engagement Intelligence Model (spec — no code yet)

A single engine that emits four owner-facing scores from one shared signal
substrate. Build the substrate once; derive scores from it. Every number must be
**explainable, auditable, reproducible** — never a bare "87".

> Status: **eii-1.0 — locked pending your final read.** Incorporates 6 revisions:
> real `visitor_id` column, AR re-weighted down, a negative **Bounce** signal,
> a Share contribution to Intent, a **Confidence** score on every number, no
> industry benchmark, and a new **Opportunity Board** (§12). No code until you
> confirm this revision.

---

## 0. Principles

1. **Unique-visit basis.** All aggregation is per distinct session/visitor (same
   rule as the rest of analytics) — no raw-event inflation.
2. **Rates, not totals.** Signals are normalized to *rates* (per viewer), so a
   low-traffic drink and a high-traffic drink are comparable. Volume lives in the
   existing KPIs; scores measure *quality of engagement*.
3. **Time-decayed.** Recent behavior weighs more, so scores track menu changes.
4. **Explainable by construction.** A score is a sum of `weight × normalized`
   terms; each term IS its point contribution. We always return the breakdown.

---

## 1. General math

For cocktail `c`, signal `s`, over the active window:

```
raw(c,s)          = decay-weighted rate of signal s among viewers of c   (see §4)
norm(c,s)         = saturate_s( raw(c,s) )           ∈ [0,1]
points(c,score,s) = weight(score,s) × norm(c,s)      (positive, explainable term)
penalty(c,score)  = Σ_neg  negWeight(score,s) × norm(c,s)   (Bounce — see §3a)
Score(c, score)   = clamp( Σ_pos points − penalty , 0, 100 )
```

Per score, `Σ_pos weight = 100`; penalties pull DOWN from there, so a drink that
everyone bounces out of cannot look good on volume alone.

**Saturation** maps an unbounded rate to [0,1] with diminishing returns:
```
saturate(x; target) = min(1, x / target)          (linear cap — default)
saturate_soft(x; k) = x / (x + k)                  (smooth, for long-tail signals)
```
`target`/`k` per signal in §3 (tunable constants, versioned with the model).

---

## 2. Time decay (global)

Each contributing event/session is weighted by age via piecewise-linear
interpolation through your anchors:

| Age | Weight |
|----|--------|
| 0 d (today) | 100% |
| 7 d | 80% |
| 30 d | 50% |
| 90 d | 20% |
| > 90 d | 10% (floor) |

```
decay(age_days) = lerp over {0:1.0, 7:0.8, 30:0.5, 90:0.2, ∞:0.1}
```
Applied when computing every `raw(c,s)`: a session that viewed `c` 30 days ago
contributes 0.5× to both numerator and denominator of its rate.

---

## 3. Signal catalog (13)

Each signal: **collection method · availability today · normalization ·
intra-signal decay (saturation) · reasoning**. "Availability" is honest about
what we capture now vs. what must be built first (see §9).

| # | Signal | Collection | Available now | Normalization (target) | Reasoning |
|---|--------|-----------|:---:|------------------------|-----------|
| 1 | **Active dwell time** | NEW `cocktail_dwell` — active seconds, paused on tab blur | ❌ build | `saturate(avgActiveSec; 45s)` | Real attention = time actually looking, not a threshold |
| 2 | **Scroll depth** | NEW `cocktail_scroll_depth` — max % reached | ❌ build | `avgMaxScroll` (already 0–1) | Did they explore the whole story or bounce at the top |
| 3 | **Ingredient interactions** | `ingredients_opened` | ✅ | `rate = ingrSessions/viewers` | Deliberate curiosity about the drink itself |
| 4 | **360 opens** | `360_opened` | ✅ | `rate` | High-effort visual exploration |
| 5 | **AR opens** | `ar_opened` | ✅ | `rate` | Highest-effort visual engagement |
| 6 | **Shares** | `cocktail_shared` / `menu_shared` | ✅ | `saturate(shareRate; 0.15)` | Advocacy; willingness to put name behind it |
| 7 | **Return visits** | distinct visitor across ≥2 sessions | ❌ needs `visitor_id` stored | `rate = returningVisitors/visitors` | Came back later → genuine interest/intent |
| 8 | **Repeat views** | ≥2 `cocktail_opened` for `c` in a session | ✅ (session) / ❌ (cross-session) | `saturate(avgViews−1; 2)` | Reconsideration / lingering interest |
| 9 | **Order initiation** | `order_started` / `add_to_order_clicked` w/o completion | ✅ | `rate` | Reached for it — strongest pre-purchase intent |
| 10 | **Order completion** | `order_completed` | ✅ | `rate` | Realized outcome (used for Conversion, lightly in Intent) |
| 11 | **Call waiter** | `call_waiter_clicked` | ✅ | `rate` | Ready to act |
| 12 | **Favorites** | NEW: wire `cocktail_favorited` (today localStorage-only) | ❌ build | `rate` | Saved intent / advocacy |
| 13 | **QR rescans** | repeated `source=table_qr` by same `visitor_id` | ❌ needs `visitor_id` | `saturate(rescans; 2)` | Re-engagement with the physical menu |
| 14 | **Bounce** *(NEGATIVE)* | derived: dwell < 3s AND scroll < 10% AND no deeper action | ❌ needs dwell+scroll | `rate = bounced/viewers` | Punishes "1000 opens, everyone flees" — the model's only down-signal |

> **Intra-signal decay** = the saturation curve above (diminishing marginal
> value: the 1st ingredient-open matters most; the 5th adds little). **Cross-time
> decay** = §2. They are separate and both apply.

### 3a. Bounce (negative signal)

A viewer **bounces** when they open a drink but show no real engagement:
`activeDwell < 3s AND maxScroll < 10% AND no ingredients/360/AR/order`. Then:
```
bounceRate(c) = decay-weighted bounced viewers / viewers
penalty(Menu Engagement) = 20 × bounceRate     (up to −20)
penalty(Guest Interest)  = 12 × bounceRate     (up to −12)
```
Shown as a negative component (`−14 bounce`) in the breakdown. Requires the dwell
+ scroll instrumentation (§9), so until then bounceRate = 0 and is labeled
"not yet measured".

---

## 4. Rate definition (per signal, per cocktail)

```
viewers(c)      = Σ_{sessions s that opened c}  decay(age(s))
withSignal(c,σ) = Σ_{sessions s that did σ on c} decay(age(s))
rate(c,σ)       = withSignal(c,σ) / max(ε, viewers(c))
```
Visitor-level signals (return visits, QR rescans) use the same form with
`visitors` (distinct `visitor_id`) instead of `viewers`.

---

## 5. The four scores

Owner-facing names in **bold**; internal name in (parens). Weights sum to 100.

### A. **Menu Engagement** (Attention) — *visual engagement*
| Signal | Weight |
|--------|-------:|
| Active dwell time | 35 |
| Scroll depth | 20 |
| Ingredient interactions | 15 |
| 360 opens | **18** |
| AR opens | **2** |
| Repeat views | 10 |
| **Bounce** | **−20 (penalty)** |
**Positives = 100**, minus up to −20 bounce. AR down-weighted (≈95% of guests
never open AR — it shouldn't swing the score until adoption proves otherwise);
360 carries the visual-exploration weight instead.

### B. **Guest Interest** (Interest) — *curiosity & exploration*
| Signal | Weight |
|--------|-------:|
| Ingredient interactions | 30 |
| Repeat views | 20 |
| Return visits | 18 |
| 360 opens | **16** |
| AR opens | **4** |
| Active dwell time | 12 |
| **Bounce** | **−12 (penalty)** |
**Positives = 100**, minus up to −12 bounce.

### C. **Purchase Intent** (Intent) — *buying likelihood (leading indicators)*
| Signal | Weight |
|--------|-------:|
| Order initiation (started / add-to-order) | 32 |
| Favorites | 20 |
| Call waiter | 14 |
| Deep consideration (ingredients × dwell) | 16 |
| Return visits | **13** |
| Shares | **5** |
**= 100.**
**Deliberately excludes order *completion*** so Intent is a *leading* signal you
compare against realized Conversion (§6). A **small Share weight (5)** is
included — "look at this drink" to a friend IS intent, just not full purchase
intent — taken from Return visits (18 → 13).

### D. **Advocacy** (Word-of-Mouth) — *sharing & loyalty*
| Signal | Weight |
|--------|-------:|
| Shares | 45 |
| Favorites | 20 |
| Return visits | 20 |
| QR rescans | 15 |
**= 100.**

> A signal can feed multiple scores at different weights — it measures different
> constructs (a Share is weak Attention but strong Advocacy).

---

## 6. The killer view: Intent vs Conversion

Show side by side, per drink:
```
Smoked Negroni    Engagement 91   Interest 87   Intent 88   Conversion 3%
→ "Guests clearly want it — something between desire and ordering is breaking."
```
Because Intent excludes completion, a high-Intent / low-Conversion gap is a
*pure* signal that the offer (price, placement, wording, availability) is the
blocker — not lack of interest. This is more actionable than any single score.

---

## 6a. Confidence = **Sample Quality**, not just size (shown on EVERY score)

50 views in one busy evening ≠ 50 views gathered over a month. Confidence is the
product of *how much* data and *how well-spread* it is:
```
Confidence(0–100) = round( 100 × VolumeScore × ConsistencyScore )

VolumeScore      = saturate(N / 50)                 // N = unique viewers/visitors (decay-weighted)
ConsistencyScore = saturate(distinctDays / 7)       // spread across days, not one burst
                   × singleSourcePenalty            // ×0.7 if ~all data is one day OR only repeat visitors
band: Low < 33 · Medium 33–66 · High > 66   (and N ≥ 10 required to exceed Low)
```
So 50 views in **one** night → high volume × low consistency → **Medium**, not
High. 50 views over a month → **High**.

**Rules:**
- A **Low**-confidence score is greyed with "needs more data" and **excluded**
  from rankings, anomalies, and the Opportunity Preview.
- Confidence is per (cocktail × score) — samples differ by signal.

This is the guardrail against concluding from 3 people *or* one lucky night.

## 7. Benchmarks (every score shown against)

```
Restaurant Average = mean score across this venue's items (Medium+ confidence only)
Category Average   = mean across same category (citrus/smoky/bitter/sweet/mocktail), WITHIN this venue
Top Item           = the single best-scoring item in this venue
```
**No industry / "Top 10%" benchmark** — it would be an illusion of precision
with one tenant. A true cross-venue category benchmark waits for dozens of
restaurants and thousands of sessions, and will be added explicitly then.

---

## 8. Anomaly detection (+ recommendation)

Thresholds are relative to the restaurant benchmark (top/bottom tercile).

| Anomaly | Condition | Recommendation |
|--------|-----------|----------------|
| **High Attention · Low Conversion** | Engagement top‑tercile & Conversion bottom‑tercile | "Strong pull, weak close — test price, position higher, sharpen the description." |
| **Low Attention · High Conversion** | Engagement bottom & Conversion top | "Quiet winner — guests order it without exploring. Feature it to grow volume." |
| **High Shares · Low Orders** | Advocacy top & order-rate bottom | "Loved as a photo, not bought here — reconsider price or make it the signature pour." |
| **High Views · Low Engagement** | Views top & Engagement bottom | "Clicks but no depth — the card over-promises; improve the hero/first screen." |

Each anomaly produces a sentence + the drink + the evidencing numbers (auditable).

---

## 9. Data prerequisites (must build BEFORE scoring)

1. **`cocktail_dwell`** event — active seconds on a cocktail page (timer that
   pauses on `visibilitychange`/blur), flushed on leave.
2. **`cocktail_scroll_depth`** event — max scroll % reached.
3. **Wire `cocktail_favorited`** — favorites are localStorage-only today; emit the event.
4. **`events.visitor_id` — a FIRST-CLASS COLUMN** (migration `0006`), not
   metadata. Required for Return visits, QR rescans, cross-session repeat views —
   and it will be the backbone of Cohorts, Loyalty, and Visitor Journeys later, so
   it must be indexable, not buried in jsonb. Backfill from `metadata` where possible.

Until 1–4 exist, those signals contribute 0 and the score transparently shows
"signal not yet collected" rather than silently dropping them.

## 9a. `visitor_id` migration phases (kill the COALESCE trap)

`COALESCE(visitor_id, metadata->>'visitorId')` is fine as a *transition* and
fatal as a *permanent state*. The dual-read lives in exactly **one** accessor
(`visitorOf()` in `signals.ts`) — never inlined elsewhere — and we move through
4 phases with explicit exit criteria:

| Phase | State | Write | Read | Exit criteria |
|-------|-------|-------|------|---------------|
| **A** *(now)* | pre-migration | `metadata.visitorId` + `visitor_id` stripped on insert (column absent) | `metadata.visitorId` | migration 0006 applied |
| **B** | post-0006 | **both** `events.visitor_id` AND `metadata.visitorId` | `visitor_id` ?? `metadata.visitorId` (the one accessor) | backfill done + `visitor_id` coverage ≈ 100% on `/admin/signals` |
| **C** | verified | both (still) | **`events.visitor_id` only** | one release soak with no regressions |
| **D** | cleanup | **stop** writing `metadata.visitorId`; delete the fallback from `visitorOf()` | `events.visitor_id` only | — done |

The dashboard's `visitor_id coverage %` is the gate signal: Phase B→C only when it
reaches ~100% for new traffic. This guarantees the dual-path is deleted on a
schedule, not left to rot.

---

## 10. Explainability output contract

Every score returns, never just a number:
```json
{
  "cocktailSlug": "diner-negroni",
  "score": "menu_engagement",
  "value": 78,
  "confidence": { "value": 64, "band": "High", "sampleN": 41 },
  "components": [
    { "signal": "active_dwell", "rate": 0.98, "norm": 0.98, "points": 34 },
    { "signal": "scroll_depth", "rate": 0.70, "norm": 0.70, "points": 14 },
    { "signal": "ingredients",  "rate": 0.62, "norm": 0.62, "points": 9  },
    { "signal": "open_360",     "rate": 0.40, "norm": 0.40, "points": 7  },
    { "signal": "repeat_views", "rate": 0.40, "norm": 0.40, "points": 4  },
    { "signal": "open_ar",      "rate": 0.05, "norm": 0.05, "points": 0  },
    { "signal": "bounce",       "rate": 0.50, "norm": 0.50, "points": -10 }
  ],
  "benchmarks": { "restaurantAvg": 61, "categoryAvg": 68, "topItem": 89 },
  "modelVersion": "eii-1.0"
}
```
Admin always renders the component bar (`34 dwell · 14 scroll · 9 ingredients ·
7 360 · −10 bounce`) plus the confidence band. `modelVersion` is stamped so
historical scores stay reproducible after re-weighting.

---

## 11. Decisions (LOCKED for eii-1.0)

| # | Decision |
|---|----------|
| visitor_id | ✅ **First-class `events.visitor_id` column** (migration 0006) — not metadata |
| Category benchmark | ✅ **Within-venue only**; no industry benchmark until multi-tenant |
| Weights | ✅ Approved **with AR down-weighted** (Engagement 360=18/AR=2; Interest 360=16/AR=4) |
| Negative signal | ✅ **Bounce** added (−20 Engagement, −12 Interest) |
| Intent | ✅ **Shares=5** added; Return visits 18→13 |
| Confidence | ✅ Added to every score; Low excluded from rankings/Opportunity Board |
| Window | ✅ **30-day rolling** with §2 decay |
| Naming | ✅ Menu Engagement · Guest Interest · Purchase Intent · Word-of-Mouth |

## 12. Opportunity **Preview** (gated → full Board after 30 days of data)

Not another chart — the screen an owner opens daily. It ranks **what to do** and
the **₪ on the table**, derived from the engine + economics. Only **Medium+
confidence** items qualify.

> **Gate (decided):** until a cocktail has **≥ 30 days** of real data, its card
> is shown as **"Potential Opportunity · Low confidence"** with the ₪ figure
> de-emphasized — an *Opportunity Preview*, not a hard claim. Hard ₪/month
> figures are presented only once the 30-day, Medium+ threshold is met. This
> prevents showing "+₪1,420/month" off a single weekend.

### Opportunity types & detection
| Type | Trigger | Action |
|------|---------|--------|
| **Demand unrealized** | Purchase Intent top-tercile & Conversion bottom-tercile | "Move higher in menu · reprice · sharpen description" |
| **Untapped advocacy** | Word-of-Mouth top-tercile & order-rate low | "Promote on Instagram / make it the signature pour" |
| **Hidden winner** | Conversion top-tercile & Views low | "Feature it — guests love it but few see it" |
| **Leaking interest** | Guest Interest high & Conversion low (the §8 leak) | "Fix the step before ordering — price/availability/wording" |

### Potential revenue (an ESTIMATE, labeled as such)
```
expectedConv   = restaurant top-quartile conversion for similar-Intent drinks
monthlyViewers = decay-adjusted unique viewers, extrapolated to 30 days
upliftRevenue  = max(0, expectedConv − actualConv) × monthlyViewers × priceAtOrder
upliftProfit   = upliftRevenue × (margin / price)
```
Shown as a **range** with the confidence band, never a false-precision number.

### Cost of Action → **ROI Score** (not revenue alone)
Revenue upside without effort cost is misleading: "reshoot all photography" and
"move one row up" are not the same ask. Each action carries an effort cost:
```
effortCost:  Low (≈0)        Medium            High
  examples:  move up in menu  reprice · reword  reshoot photo · rebuild recipe
ROIScore = upliftProfit / effortCost   →   ranked DESC (best bang-per-effort first)
```
| Action | Effort |
|--------|--------|
| Move higher in menu / reorder | **Low** |
| Reprice · sharpen description · QR campaign | **Medium** |
| Reshoot photography · re-engineer recipe | **High** |

Cards rank by **ROIScore**, not raw ₪ — so the owner sees the cheapest wins first.
Example:
```
Smoked Negroni                    confidence: High · effort: Low
Purchase Intent 88 · Conversion 3%
Estimated upside: +₪900–₪1,420 / month   ·   ROI: ★★★★★
→ Move higher in menu · test price
```
Each card carries its driving scores, the estimate range, effort, ROI, the action,
and a one-tap link to the drink's full Engagement breakdown (always auditable).

---

## eii-1.1 roadmap (TODO — not first implementation)

- **Cannibalization Detector.** When item A rises and item B (same category, same
  period) falls with **flat total category revenue**, flag it — "you moved
  spend, not grew it." Prevents the model from celebrating a zero-sum shuffle.
- **Graded Bounce (Soft / Hard).** Replace the binary bounce: `1s, 0 scroll` =
  **Hard** (full penalty); `8s, 20% scroll, no deeper action` = **Soft** (partial
  penalty). v1 binary is acceptable; this refines it.

---

## 13. Build order (after this revision is confirmed)
1. **Instrumentation:** migration 0006 (`visitor_id` column) · `cocktail_dwell` ·
   `cocktail_scroll_depth` · wire `cocktail_favorited`.
2. **Engine:** signal aggregation (decay + rates + confidence) → the four scores
   with component breakdowns. Prove with synthetic fixtures per signal.
3. **Admin:** Engagement screen (scores + breakdown bars + confidence + benchmarks + anomalies).
4. **Opportunity Board** on top of the engine.
Each layer proven before the next.

---

## 14. Signal Verification — Source of Truth, Baselines & Thresholds (LOCKED)

Before any Trend / Drift / Readiness number is interpreted, its definition is
fixed here. No re-interpretation later.

### 14.1 Source of truth (per metric)
| Metric | Source of truth | Notes |
|--------|-----------------|-------|
| **Coverage Trend** | **Realtime query** over `events` (recent vs prior window) | A `daily_signal_snapshot` rollup table is the eii-1.1 scale path; until volume needs it, realtime is canonical. |
| **Drift** | **Realtime query**, recent window vs a **30-day baseline** | Baseline is the *prior* 30 days, not all-time, so it adapts to menu changes. |
| **Engine Readiness** | **7 consecutive ready days** (computed per-day from `events`) **AND** the current snapshot | Not "current health" alone — a single good hour cannot flip the gate. |

### 14.2 Windows (fixed)
- **Recent** = last **7 days**.
- **Trend prior** = the **7 days before that** (days 7–14) → week-over-week.
- **Drift baseline** = the **prior 30 days** (days 7–37).

### 14.3 Drift thresholds (3-tier)
Applied to `|Δ%|` of a signal's recent value vs its 30-day baseline, and only
once both windows have a **minimum sample** (≥10 for distributions, ≥20 events
for rates):
```
|Δ| < 20%      → Normal   (healthy)
20% ≤ |Δ| ≤ 50% → Warning
|Δ| > 50%      → Alert    (fail / "critical drift")
```
Below the minimum sample → **Normal** (we can't claim a shift we can't measure).
This stops noise like `22s → 25s` (+14%) from alerting.

### 14.4 Engine Readiness — ALL must hold (objective gate)
```
Engine Ready = YES   ⇔
   Visitor coverage ≥ 95%        (recent window)
 ∧ Source coverage  ≥ 95%        (recent window)
 ∧ Instrumentation Health = Green for the CORE signals
       (Dwell, Scroll, Favorites, Visitor, Source — Table/Revenue exempt:
        they depend on QR usage & orders, not on the engine's inputs)
 ∧ No Critical Drift             (no drift item at Alert/>50%)
 ∧ Minimum sample size           (≥ 500 events ∧ ≥ 50 dwell ∧ ≥ 50 scroll)
 ∧ 7 consecutive ready days       (each day ≥ 95% visitor & source coverage with traffic)
```
Any single failing condition → **NO**, with the exact blocker listed. This makes
the start of the Engagement Engine a fully **objective** decision — no "feels
ready". Warnings (20–50% drift) are visible but do **not** block; only Alerts do.
