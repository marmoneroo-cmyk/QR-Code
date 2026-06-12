# Menu Performance & Ordering Intent — model v3 (the product's KPI)

The product is **AI Menu Optimization**. Its question: *did a change improve a dish's menu performance —
how far do guests climb from **seeing** it to **wanting** it?* This doc is the source of truth; closed loop,
wins, opportunities and AI recommendations all read the ladder & **funnel shape** from here.

## Two rules that override everything

1. **The funnel SHAPE is the metric — not a weighted score.** Different dishes have different natural
   funnels (a cocktail leans on AR+video; a burger may have 90% who never open AR; a wine leans on
   description+ingredients). Hard-coded weights would bake in bias we cannot justify yet. So:
   **instrument every level first, collect real restaurant data, and DERIVE weights later from observed
   behavior.** Until then there is **no single Menu Performance Score** — the system reports the shape.
2. **Each session is counted once, at its highest rung.** A guest who opened AR + ingredients + watched the
   video + tapped "wants this" is **one** Ordering-Intent guest, not 4 points. This is a system law — it is
   the only thing that stops the numbers from being trivially inflated (the Hall-of-Wins trap).

## Why the KPI is NOT "Strong Intent alone"
In a real bar the **actual order is invisible** — a guest explores the drink for 40s, then calls the waiter
and orders **verbally**. No POS, no tap. A KPI hinging on the final tap would score that working dish as a
failure. So **deep engagement (High Interest) counts on its own**, and the funnel shape — not the last rung
— is what we judge.

## The 5-layer ladder (with FULL multi-level instrumentation — never lose information)

```
Reach  →  Interest  →  High Interest  →  Ordering Intent  →  Verified Improvement
```

| Layer | Signals (every level captured) | Event(s) | Status |
|---|---|---|---|
| **Reach** *(denominator)* | Saw the dish | `cocktail_impression` | ✅ |
| **Interest** | Opened item · ingredients · **video Started** · **AR Started** · dwell | `cocktail_opened`, `ingredients_opened`, `cocktail_video_opened`, `ar_opened`, `cocktail_dwell` | ✅ |
| **High Interest** | **video ≥ 50% / Completed** · **AR Engaged (≥5s) / Deep (≥15s)** · **viewed ≥ 3× / revisits** | `cocktail_video_progress` (value=max watched %) ❌NEW · `cocktail_ar_dwell` (value=seconds) ❌NEW · computed from `cocktail_opened`×`visitor_id` ⚠️compute | **missing** |
| **Ordering Intent** | "Wants this" · **auto-derived Favorites** (opt. ❤ Save) · "Ready to order" · (future add-to-cart) | `add_to_order_clicked` ✅ · `cocktail_favorited` (auto + opt. Save) · `order_completed` ✅ (mislabeled) | partial |

> **`call_waiter` removed from the model** — this is not an ordering/waiter system. **Favorites is not a button**: derive "Your Favorites" from behaviour (dwell/video/AR/revisits), optional ❤ Save only if the guest wants it. *Don't pollute a cinematic, luxury menu for analytics.*
| **Verified Improvement** *(outcome, not a guest rung)* | A change the closed loop **certifies** moved the funnel | — (measurement output) | — |

**Capture levels, don't collapse them.** Video is one event carrying **max-watched-%** per session → derive
Started (>0) / Half (≥50) / Completed (≥~95). AR is one event carrying **max-seconds** → derive Started /
Engaged (≥5s) / Deep (≥15s). Thresholds are *derived from the value*, not hard-coded as separate events, so
no information is lost and the cut-points can be re-tuned from data without re-instrumenting.

## GOLDEN RULE — Collect first, interpret later
Build the data lake **now**; interpret only once the data is trustworthy (after Auth · Tenant Isolation ·
Queue · Integrity · Honest Measurement). Rushing to conclusions on untrusted data is the classic AI-product
mistake — we don't.

**Raw signals to collect now (H-A)** — store the observation, never a conclusion:
`cocktail_impression`, `cocktail_opened`, **`cocktail_revisited`(+ gap since last view)**, `ingredients_opened`,
`cocktail_video_opened` + **`cocktail_video_progress`(max %)**, `ar_opened` + **`cocktail_ar_dwell`(seconds)** +
**`cocktail_ar_completed`(reserved — fires when a bounded AR experience exists)**, `cocktail_dwell`,
`cocktail_scroll_depth`, `add_to_order_clicked`, `order_completed`, and (once their controls exist)
**auto-derived** `cocktail_favorited` (behaviour-based + optional ❤ Save). *(`call_waiter_clicked` removed.)*

**Derived later (H-B), from the raw timeline — NOT new events:** time-to-first-interaction, exit-point,
session-depth, the stage-conversion rates, and (eventually, learned-not-set) the score.
*Revisit is captured RAW (not derived) — the time-gap between visits is information that must not be
reconstructed from a lossy timeline (owner's call, conceded).*

## The KPI: the funnel shape (per dish, per window, distinct sessions, highest rung)

Report the **stage-conversion profile** — this is what the AI Coach reads and the owner sees:
```
Reach → Interest        e.g. 84%
Interest → High Interest e.g. 60%
High Interest → Intent   e.g.  2%   ← the insight lives in the drop-off
```
Not “Score = 71”, but “**84% reach interest, only 2% continue to ordering intent.**”
A single weighted **Menu Performance Score is DEFERRED** until weights can be *learned* from real
multi-restaurant data (a later phase, not a sprint). A visual-only roll-up may be shown for sorting, clearly
marked as indicative, never as the diagnosis.

### The AI Coach reads the SHAPE (the real engine)
| Funnel | Diagnosis → recommendation |
|---|---|
| 1000 reach · 800 open · 600 AR · 500 video · **10 intent** | Loved, no next step → **price / description / position** |
| 1000 reach · **100 open** · 80 intent | Those who see it want it → **exposure problem (position / extra QR)** |
| 1000 reach · **50 open** · 5 intent | Doesn't attract attention → **try a new image** |

This is why **AI Recommendation Validation (Epic I)** is the real quality bar.

## Honest naming (no purchase implication — DB event names unchanged, labels only)
| Event | Today (misleading) | → New label |
|---|---|---|
| `add_to_order_clicked` | "Added to order" | **"Wants this"** |
| `order_completed` | "Order placed / הזמנה בוצעה" | **"Ready to order"** (ask-waiter intent, NOT a sale) |
| `order_started` | "Order started" | (drop / internal) |

## Hall of Wins → "Verified Improvement" (per-layer deltas, never revenue)
```
Aperol Spritz
 +42% Ordering Intent
 +85% Video Completion
 Verified Improvement
```

## Non-negotiables
- **Intent ≠ sale.** The system cannot see verbal/POS orders → it never claims to measure orders or revenue.
- **Instrument first, weight later.** No hard-coded score weights until real behavior reveals what predicts a
  "working dish" vs a "non-working dish."
- **One module** encodes the ladder + funnel-shape; everything consumes it. **No metric on a dead event.**
