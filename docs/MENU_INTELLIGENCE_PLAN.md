# Menu Intelligence — Product Direction & Execution Plan

**Status:** decided 2026-06-07 · supersedes any "ordering system" direction.

## 0. The decision (locked)

The product is **Menu Intelligence** — "Google Analytics for restaurant menus."
It is **NOT** an ordering system.

We do **not** build: POS, kitchen routing, payments, inventory, staff permissions,
order fulfillment. Those belong to systems the restaurant already runs (Tabit, Sunday,
Ontopo, …). We are the **experience + behavioral-intelligence layer that sits ABOVE**
those systems — never a competitor to their core.

Why: ordering is per-tenant, regulated, slow to sell, and already owned by incumbents
(Tabit alone does tableside ordering + QR pay + KDS). Our moat is the data nobody else
has: **what guests wanted, looked at, and were drawn to — including when they did NOT buy.**

## 0.5 North Star — Action, not metrics

The platform never stops at a number. Every major analytics screen must answer one
question: **"What should the owner do next?"** — a concrete recommendation, with a
rationale and an honest estimated impact. The destination is **Menu Optimization**,
not Menu Analytics.

The product is three layers (and nothing more):

1. **Guest Experience Layer** — the luxury menu the diner sees and feels.
2. **Behavior Intelligence Layer** — what they viewed, wanted, and where they got lost.
3. **Menu Optimization Layer** — the action the owner should take next, and proof it worked.

> Not a POS. Not an ordering platform. Not a kitchen system.

| Screen | Stop here (no) | Go here (yes) |
|--------|----------------|---------------|
| Menu Blind Spot | "Item has 12 views" | "Move this item higher. Est. visibility +40% *(only if data supports it)*" |
| Conversion Leak | "High engagement, low intent" | "Interest but no commitment — test the image, description, or price" |
| Social Impact | "35 shares" | "Strong word of mouth — promote this item" |
| Price Sensitivity | "Intent stable" | "This item may support a higher price" |
| Position Analyzer | "Views increased" | "Keep the item in its current position" |

## 1. The dependency that shapes the whole plan

Several high-value owner features ("Conversion Leak", "Lost Revenue", "Price
Sensitivity", "Best Position") need a **conversion denominator** — you cannot say
"they wanted it but didn't buy" without knowing what was bought.

We get that denominator **without building an ordering system**, via two instruments:

1. **Soft intent signal** — `♥ / "My Picks → show your waiter"`. Stated intent, zero
   integration. The event `cocktail_favorited` already exists.
2. **Read-only sales ingestion** — we *read* what sold (POS export / nightly CSV / later
   a read-only API). We never *write* orders. `Engagement ÷ Sales = the real leak.`

**Data-honesty rule:** until sales ingestion exists, every "revenue / conversion" number
is labeled **INTENT / POTENTIAL**, never "actual sales." No faked fulfillment, ever.

## 2. REMOVE (מורידים)

| Item | Why | Notes |
|------|-----|-------|
| Ordering **fulfillment** UX — "Send order → Sent ✓", "Call waiter → on the way ✓" | Promises a transaction we don't fulfill; faking it breaks trust in a luxury setting | Replace with the **intent** action (§3), don't just delete the signal |
| `call_waiter_clicked` as a diner action | Implies we ping staff; we don't (no integration) | Revisit only if a restaurant wants a real staff-tablet ping |
| Dead 360 code: `Cocktail360.tsx`, `Cocktail3D.tsx`, `Spin360.tsx` | 360 removed from the product; isolated dead cluster (not imported by live scenes) | Keep **AR** (`/ar/[slug]`) — different feature, stays |
| `/spin/[slug]` route | Serves the dead 360 view | |
| `has3DModel` / `model3dUrl` in `cocktail.ts` + the "old 360 view" comment | Dead helpers | |
| Treat **CRM** screen as *review/defer* | No customer identity without login → thin value today | Fold useful bits into Journeys; don't invest until identity exists |

> Decision on order events: **retire `order_completed`/`order_started` as "real sales."**
> Keep an intent capture (favorite / add-to-picks). `revenue`/`profit` snapshots become
> **intent value** until real sales are ingested. The eii model's Purchase-Intent inputs
> shift to: favorited + picks + small share weight + (later) ingested sales.

## 3. IMPROVE (משפרים — mostly rewire what exists)

| Feature | Current state | Improvement |
|---------|---------------|-------------|
| **Session Journeys** (value #1) | `getSessionJourneys` ✓ | Polish — this is the crown jewel; per-visitor path, re-visits, exit point |
| **Conversion Leak** (value #2) | `getCocktailFunnels` ✓ | Rewire "conversion" → intent (now) + sales (later); surface high-engagement / low-intent drinks |
| **Co-Viewing** (value #8) | `getCoViews` ✓ (admin only) | **Surface to diners** as "guests who viewed this also viewed…" (replaces static `Pairings`) |
| **Table Intelligence** | `getTableIntelligence` ✓ | Add avg session length, engagement-vs-intent rate, "interested in expensive cocktails" |
| **Social Impact** | `cocktail_shared` ✓ | Add share-rate metric (shared ÷ viewed) per drink |
| **Intent signal (♥ / My Picks)** | `cocktail_favorited` defined; not wired in `MenuCard` | Wire the favorite action end-to-end; build the "My Picks" list to show the waiter |
| **Signal Verification gate** | `getSignalVerification` ✓ | Keep as the trust foundation — no scores ship until green |
| **Executive summary** | `getExecutiveSummary` ✓ | Reframe around the new (intent-not-sales) language |

## 4. BUILD (new — sequenced by dependency, then the owner's value ranking)

**Phase A — Instruments (unblock everything else)**
- Solidify the **intent signal** (♥ / "My Picks") — capture + show-waiter list.
- **Per-section attention tracking** → the **Attention Heatmap** instrument
  (IntersectionObserver per section: image / ingredients / video / price / story).
  Note: video is now the hero interaction (360 gone).
- **Read-only sales ingestion v1** — CSV/manual import of "what sold" → the conversion
  denominator. This is the single highest-leverage build for the owner features.

**Phase B — Owner core (high value, mostly leverages existing data)**
- **Menu Blind Spots** (value #5) — `cocktail_impression` (visibility) vs `cocktail_opened`
  (interest): distinguish "nobody saw it" from "nobody wanted it."
- **Lost Revenue Detector** (value #3) — high views + strong engagement + low intent/sales → flag + reason hypothesis.
- **Social Impact** dashboard (share rate as a marketing signal).

**Phase C — Owner advanced (need longitudinal + sales data)**
- **Best Position Analyzer** (value #4) — position change → views/intent delta.
- **Price Sensitivity** (value #6) — price change → intent/conversion delta over time.
- **Menu Fatigue** — % of guests who only view the first N items → "menu too long / move signatures up."
- **A/B Testing** (value #7) — extend `/admin/experiments` (`experiment_exposure` exists); cross-restaurant tests later.

**Phase D — Diner-facing (drives engagement AND generates the data)**
- **"Also liked"** — surface `getCoViews` on the diner cocktail page.
- **Mood filter / "What suits me now?"** — upgrade `MenuFilters` (sweet/sour/refreshing/
  strong/fruity → 3 picks). Feels like a personal sommelier.
- **Time-of-day rules** — "Perfect for sunset" / "Warm & smoky" (simple rules, no AI).
- **Top Picks** — Most Shared / Most Viewed / Bartender Favorite / Hidden Gem (not "most ordered").
- **Short story per cocktail** — "Inspired by the Amalfi coast" (emotion; elegant, minimal).

> Diner features (Phase D) also *feed* the owner features — interleave the early wins
> (Also-liked, Top Picks) for demo appeal since they boost engagement and data at once.

## 5. VERIFY (מוודאים שתקין — correctness gates)

- ✅ Migration `0006_visitor_id` applied (verified: column exists, 235/392 backfilled).
- **Unique-session counting** everywhere — no raw-event inflation.
- **Attribution** correct: `source` (real channel) vs `origin` (declared `?src=`); `table_qr` vs viral.
- **Every event that backs a feature actually fires** (impression, favorited, dwell, scroll, share, video_opened, section-attention).
- **Revenue/profit relabeled as INTENT** until sales ingestion (data honesty).
- **Signal Verification gate** drives scoring — do not ship eii scores until "Engine Ready = YES" 7 days.
- After REMOVE + each BUILD: `npx tsc --noEmit` → `npx next build` → deploy → prod smoke test.

## 6. Design guardrail

Luxury = minimal. Every diner-facing addition (mood filter, Top Picks badges, story)
must stay restrained and elegant — no Vegas-casino / template energy. When in doubt, less.

## 8. The Recommendation Layer (the Optimization engine)

Every analytics module emits, alongside its metrics, a `Recommendation`:

```
Recommendation {
  action:          string   // imperative: "Move higher in the menu", "Test a new image"
  rationale:       string   // the evidence behind it
  estimatedImpact: string?  // e.g. "+40% visibility" — DERIVED from data, never invented
  confidence:      'low' | 'medium' | 'high'   // from sample size + consistency (reuse Signal layer)
  status:          'suggested' | 'dismissed' | 'applied'
}
```

**Integrity gate (non-negotiable):** a recommendation shows a *numeric* impact estimate
**only** when confidence supports it. Otherwise it states the direction and says
"collect more data" — **no fabricated numbers.** A fake "+40%" is worse than no estimate;
it destroys the owner's trust the moment one prediction misses. This is the same
discipline as `/admin/signals` — optimization rides on the gate, not around it.

**Close the loop → real optimization.** When the owner *applies* an action (moves a
position, changes an image, runs a promo), the platform measures the actual outcome and
feeds it back to Best Position Analyzer / A/B / Price Sensitivity. Suggest → apply →
measure → learn. That loop is what makes this Optimization, not Analytics.

## 9. Menu Experience Builder (owner-configurable, no developer)

Every item carries a **configurable experience layer**, editable in Admin. The owner can
enable / disable / **schedule** each module — never needing a developer.

- **Content modules:** Hero Video · Ingredient Breakdown · Story · Taste Profile ·
  Perfect Pairings · Related Items · Mood Tags.
- **Badges:** Signature · Guest Favorite · Trending · Happy Hour · Discount · Seasonal ·
  Limited Time · New Item · Custom.

**Manual vs data-driven badges:** some badges are *earned from analytics*, not just
toggled — Guest Favorite, Trending. The builder supports both modes: `manual` (owner
forces it) or `auto` (the platform activates it when the data crosses a threshold —
reusing the Behavior Intelligence layer). This is where the three layers fuse.

**Data model:** per-item `experience_config` (jsonb) in Supabase, extending the existing
store layer (`store/interface.ts` + the `0003_cocktail_extras` migration pattern). Admin
writes config; the diner app reads "what is active right now."

## 10. Promotions Engine

- **Discount types:** Happy Hour · % discount · fixed discount · category discount · item discount.
- **Scheduling:** one-time ranges · time-of-day · day-of-week · seasonal · recurring.
- **Auto-badge:** when a promotion becomes active, its badge activates automatically.
  **Promotions are the single source of truth for promo badge state** — badges never
  duplicate the schedule, they read it.
- **Pricing honesty:** a discount changes the displayed price *and* snapshots both the
  original and discounted price into events, so Price Sensitivity sees real price points
  over time (not a smeared average).

## 11. Architecture note — ONE scheduling core

Experiences (§9), badges (§9), and promotions (§10) all need the **same** time-window
logic. Build it **once**:

```
Schedule = OneTimeRange | RecurringDayTime | Seasonal
isActiveNow(schedule, restaurantTz): boolean   // evaluated SERVER-SIDE
```

- Evaluate in the **restaurant's timezone**, server-side — never trust the client clock
  (a guest with a wrong phone clock must not see/hide a Happy Hour).
- Everything schedulable reuses this primitive — no three separate schedulers.
- **Serving:** use Next.js revalidation so a scheduled change (Happy Hour at 18:00) appears
  **without a redeploy**. Scheduling is worthless if it needs an engineer to take effect.

This `Schedule` primitive is a **Phase A instrument** — foundational, built before the
Experience Builder and Promotions Engine that depend on it.

## 7. The long game

At ~50 restaurants the cross-tenant data becomes the real moat: opt-in, privacy-safe
**benchmarks** ("you're top 10% for cocktail engagement"). No ordering system holds
"what guests wanted but didn't buy." That sentence is the pitch.

## 12. Build status — 2026-06-07

**Shipped & live (verified: 35 unit tests, tsc, build, prod smoke):**
- ✅ REMOVE bucket — 360/spin dead code gone; OrderBar → honest "My Picks" intent.
- ✅ Scheduling core (`src/lib/scheduling`) — the §11 shared primitive, DST-correct, tz-aware.
- ✅ Menu Experience layer (`src/lib/experience`) — module toggles + manual/auto badges (§9 read model).
- ✅ Promotions Engine (`src/lib/promotions`) — discounts + auto promo-badges (§10 logic).
- ✅ Menu Optimization layer (`src/lib/optimization`) + `/admin/optimize` — §0.5 + §8, with the honest-estimate gate.
- ✅ Diner-facing badges + promo pricing on menu cards (`src/data/experience.ts` starter config).
- ✅ Migration `0007_experience_promotions.sql` authored (cocktails.experience_config + promotions table).

**Also shipped (2026-06-07, second pass):**
- ✅ Migration `0007` applied. **Promotions Engine fully DB-driven & verified E2E** — `/admin/promotions` CRUD + `/api/promotions` + diner `useMenuConfig` loader (falls back to in-code).
- ✅ **Menu Experience Builder** — `/admin/experience` + `/api/experience` + `menu_experience` table (migration `0008`). Built & deployed; persistence activates once `0008` runs.

**Shipped (third pass):** ✅ `0008` · Experience Builder & Promotions verified E2E · "Guests also viewed" · Mood filter · sales ingestion wired into Optimize.

**Shipped (fourth pass — PLAN COMPLETE):** ✅ `0009` applied & sales verified E2E · per-cocktail **stories** · **time-of-day** hint · **Top Picks** (data-driven) · **Attention Heatmap** (`SectionAttention` instrument → `/admin/heatmap`).

## ✅ STATUS: COMPLETE (2026-06-07)

All three layers are live: **Guest Experience** (luxury menu, badges, promos, stories, mood, time-of-day, video) · **Behavior Intelligence** (full event pipeline, journeys, co-views, signals, heatmap) · **Menu Optimization** (recommendations with the honest-estimate gate, sales-backed conversion). Migrations `0006`–`0009` applied. 49 unit tests. Admin: **opportunities** · optimize · experience · promotions · sales · heatmap (+ existing analytics/menu-eng/tables/journeys/signals/experiments). The **Opportunity Board** (`/admin/opportunities`) is the morning "what should I do today?" surface — typed opportunities (position-aware Blind Spots, Share & Returning-Visitor intelligence) + Menu Layout Intelligence; engine `src/lib/opportunities` (8 tests), all engagement rates clamped ≤100%.

**Future (not blocking):** cross-tenant benchmarks at scale; gate admin writes behind member auth (Phase 2); wire experience-module toggles into the desktop scene; expand heatmap section coverage to desktop + video/price.
