# Value-First Roadmap — "How does this make me money?"

Owner review (restaurant owner / bar owner / investor / SaaS PM lens). Core thesis:
**too many screens show DATA, too few show VALUE.** A manager buys: more sales, more
guests, more profit, less work. Every screen must answer *"how does this make me money?"*

## Hard constraint (must honor on every item below)
**No fabricated numbers.** All "revenue potential / צפי" is computed from REAL data
(views × conversion-gap-to-menu-median × price/margin), labeled as an estimate, shows its
assumption, and shows "collect more traffic" when data is insufficient. Engine: `src/lib/value/potential.ts`.

## The 3 changes that move it from "nice" → "wow, I'd buy this"
1. **Revenue potential everywhere** — a prominent, honest ₪-upside on every decision item.
2. **Before / After on every recommendation & experiment** — visual current → projected.
3. **More food/drink imagery, less text** — bigger glasses, fewer words.

---

## Per-screen scores & asks (owner review, verbatim intent)
| # | Screen | Score | Top asks |
|---|--------|-------|----------|
| 1 | All-screens launcher | 7 | Hero: ₪ open potential · N actions today · +% forecast. Cards w/ mini preview + "3 active · ₪420 this week". |
| 2 | Opportunities | 8.5 | **ROI / צפי רווח ₪**, potential progress bar, visual Before/After. |
| 3 | Closed Loop | 6.5 | **Timeline** (Recommendation↓Done↓Measured↓Worked↓Into model), big drink image, counter "47 closed · 31 worked · 66%". |
| 4 | Promotions | 8 | Visual weekly **calendar**, **₪ revenue generated** per promo, bigger image. |
| 5 | Experience builder | 9 | Live **phone mockup** (real-time), badge preview instant, "89% tapped" heatmap. |
| 6 | Sales ingest | 5 | Huge **drag & drop** (Dropbox-style), status "14,302 loaded ✓", post-import graph. |
| 7 | Performance | 7.5 | Kill the table → **cards** per drink (views/engagement/conversion + %), **sparkline** per row. |
| 8 | Menu analysis | 9 | **Quadrant chart** (Boston matrix: stars/cows/problem/dogs), **AI summary** "3 things this week". |
| 9 | Guests | 6 | Too empty. **Avatar stack**, **journey map** (QR↓open↓view↓order). |
| 10 | Recommendations | 9 | **Money potential — big, bold, huge**, ranking "#1 this week", Top-Pick ribbon. |
| 11 | Menu editor | 7 | Real **drag&drop**, live menu **preview (split screen)**, **undo history**. |
| 12 | Import | 6 | **Wizard** (1 upload · 2 scan · 3 AI · 4 done), impressive success view. |
| 13 | QR cards | 8 | Per-QR **analytics**, heatmap, table preview. |
| 14 | Table cards | 8.5 | **3D preview**, PDF preview, theme gallery. |
| 15 | Executive | 9.5 | Counter animation, **revenue forecast**, "what to do now" — 3 actions. |
| 16 | A/B experiments | 6.5 | Visual **before/after**, **Winner badge**, performance graph. |
| 17 | Events inspector | 7 | Timeline, session replay, colored categories. |
| 18 | Signals | 8 | Big **QA score**, progress ring, **auto-fix** button. |
| 19 | Changelog | 5 | Make it a **Roadmap** + timeline + who-changed-what. |

## New screens to add
1. **Revenue Center** (most important) — one screen: "how much money the system generated."
2. **Executive Weekly Report** — "this week: +₪1,260 · +17 orders · 3 recs worked".
3. **AI Coach** — "Today, promote Aperol Spritz — reason: 42 searches."
4. **Live Restaurant** — who's browsing now, which drink open, which table.
5. **Leaderboard** (chains) — branch vs branch.

---

## NORTH STAR (owner reframe — "growth engine, not analytics dashboard")
The product must feel like a **restaurant sales-growth machine**. The ONE KPI that matters:
**Revenue — Influenced / Generated / Potential** — never views, events, clicks, or sessions.
The first screen every owner sees must answer in 3 seconds: *"how much money did this make me?"*
Every major workflow should point back to the **Revenue Center**.

> Integrity caveat (non-negotiable): "Generated" is an attribution claim → only show what is
> **measured** (Closed Loop wins). "Potential/available" is an **estimate** (labeled). Never
> fabricate a big "generated" number — a paying customer who catches it churns.

## Execution sprints (re-prioritized per owner)
- **Sprint 1 — DONE:** `potential.ts` estimator (+tests) · `PotentialValue`/`BeforeAfterBar` · applied to Opportunities, Recommendations, Optimize, Executive+Home hero.
- **Sprint 2 — Revenue Center (THE landing screen) + Home upgrade:** giant `/admin/revenue` — "available now (est.)" + "proven (measured)" + counter (X measured · Y worked · Z%) + where-the-money-is breakdown + Act-now CTA. Make it the entry point (person icon + nav #1). Home hero → "N actions · ₪ available now · ₪ realized · [Act now]".
- **Sprint 3 — the "wow" value screens:** **Hall of Wins** (successes only, ₪ + % per drink) · **AI Coach** (one big card: "do X today · reason · est ₪ · [auto-apply]") · **Live Restaurant** (Guests reborn: "17 active now · table 4 viewing Aperol…").
- **Sprint 4 — kill card-grid fatigue + real before/after:** introduce 4 block types (Hero / KPI / Story-with-image / Chart); **2× all drink images** (drink ≈ 40% of card, not 10%); **visual** Before/After (image + "bartender rec: none → Aperol", not bars/%). Menu quadrant chart + AI summary.
- **Sprint 5:** Sales drag&drop + status + graph · Performance cards + sparklines · Closed Loop timeline · Experiments before/after + winner · Signals QA ring · Import wizard.
- **Sprint 6 (heavy):** Leaderboard (chains) · menu editor drag&drop+undo · QR/table previews · Changelog→Roadmap.

## Scorecard (owner, current): UX 8.5 · UI 8 · Product thinking 9 · **Business-value visibility 6.5** ← the gap = the sale.
