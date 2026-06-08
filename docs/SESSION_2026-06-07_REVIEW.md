# Build Session Review — 2026-06-07 (for external review / GPT)

**Project:** `cocktail-demo` — a luxury interactive cocktail-menu platform for restaurants.
**Stack:** Next.js 16 (Turbopack, App Router), React 19, TypeScript (strict), Tailwind v4,
Framer Motion, React-Three-Fiber. Backend: Supabase (Postgres + RLS), ref `fihaaolredpqbdrdpuca` (eu-central).
**Deploy:** Vercel → https://cocktail-demo-delta.vercel.app
**First tenant:** "Diner" (slug `diner`), restaurant_id `b508cc7e-b94d-4e7d-8718-22708309a919`.

> This document is self-contained: it summarises everything done on 2026-06-07 so a
> reviewer with no repo access can sanity-check the decisions and the implementation.
> Review questions are at the bottom (§10).

---

## 1. What we set out to do today

1. Content: add two cocktail videos (Pinky, Garden Spritz), like the existing Aperol setup.
2. Security: audit the repo for leaked secrets and harden it.
3. **The big one:** decide the product direction and build it — turning the app from a
   pretty menu into a **Menu Intelligence + Optimization platform**.

---

## 2. Strategic decisions (with rationale) — please scrutinise these

### 2.1 The product is intelligence/optimization, NOT an ordering system
We explicitly decided **not** to build ordering / POS / kitchen / payments. Reasoning:
- Ordering is per-tenant, regulated, slow to sell, and already owned by incumbents.
- In Israel most restaurants run **Tabit**, which already does tableside ordering, QR
  order-&-pay, and KDS. We would be duplicating their core and competing with the partner
  we'd need.
- Our moat is the data nobody else has: **what guests wanted, looked at, and were drawn to —
  including when they did NOT buy.**

So we position as the **experience + intelligence layer above** the POS, not a POS.

### 2.2 "My Picks", not fake ordering
The old in-app `OrderBar` faked fulfilment ("Sent ✓", "Waiter coming ✓"). In a luxury
setting a fake confirmation breaks trust. We converted it to an honest **intent** surface
("Add to my picks → Show waiter"). We kept the intent **events** (they're the strongest
purchase-intent signal) but relabelled the captured revenue as **intent / potential value**,
never "actual sales".

### 2.3 The conversion denominator
Owner features that mention conversion (Conversion Leak, Lost Revenue, Price Sensitivity)
need a denominator — you can't say "they wanted it but didn't buy" without knowing what
sold. We get it **without** an ordering system via:
- a soft intent signal (♥ / My Picks), and
- **read-only sales ingestion** (we READ what sold from a CSV/POS export; we never WRITE orders).

### 2.4 North Star: Action, not metrics
Every analytics screen must answer **"what should the owner do next?"** The destination is
**Menu Optimization**, not Menu Analytics.

### 2.5 Integrity gate (the most important rule)
A recommendation shows a **numeric** impact estimate **only** when it's derivable from data
AND confidence is sufficient. Otherwise it states a direction and says "collect more data" —
**never a fabricated %.** A fake "+40%" is worse than no number; it destroys trust the
moment one prediction misses. (Same discipline as the existing `/admin/signals` readiness gate.)

### 2.6 The three layers (and nothing more)
1. **Guest Experience** — the luxury menu the diner sees.
2. **Behavior Intelligence** — what they viewed, wanted, where they dropped.
3. **Menu Optimization** — the action the owner should take next, and proof it worked.

---

## 3. Morning work (content + security + cleanup)

- **Videos:** added hover + feature videos for **Pinky** (`/cocktail/video/diner-pinky.mp4`)
  and **Garden Spritz** (`/cocktail/video/garden-spritz.mp4`), wired via `COCKTAIL_VIDEOS`
  in `src/data/cocktail.ts` (same pattern as Aperol). Verified on prod (`200 video/mp4`).
- **Security audit:** scanned all 24 git-tracked files — **0 real secret values** leaked
  (the 5 "hits" were env-var *names*, not values). `.env.local` is gitignored and was never
  committed. Sanitised `.env.example` (removed a real-looking Gemini key → placeholders) and
  added `!.env.example` to `.gitignore`. Committed those two files (`chore: sanitize .env.example`).
  Conclusion: secrets were exposed only via chat, not the repo → **rotation of the Supabase
  `service_role` + DB password is still recommended** (open TODO).
- **360 removal (cleanup):** deleted dead `Cocktail360.tsx`, `Cocktail3D.tsx`, `Spin360.tsx`,
  the `/spin/[slug]` route, and `has3DModel`/`model3dUrl`/`COCKTAILS_WITH_3D` from
  `cocktail.ts`. Verified zero live references; `/spin` → 404, AR kept (`/ar` → 200).

---

## 4. Menu Intelligence — what we built (module by module)

All pure-logic modules have **vitest** unit tests (vitest was added today — first tests in the repo).
**Total: 41 tests passing.**

### 4.1 Scheduling core — `src/lib/scheduling/`
The ONE shared time-window primitive reused by badges, experience modules, and promotions.
- Window kinds: `recurring` (weekly days + time, supports midnight-spanning), `range`
  (inclusive dates + optional daily time), `seasonal` (MM-DD, wraps the year-end).
- Evaluated in the **restaurant timezone** (DST-correct via `Intl.DateTimeFormat`), with an
  **injected `now`** so it's pure/testable. Empty schedule = always active.
- Key function:
  ```ts
  isScheduleActive(schedule, now, tz): boolean   // 10 tests
  ```

### 4.2 Menu Experience layer — `src/lib/experience/` + `/admin/experience`
- Per-item config: content-module toggles (`hero_video`, `ingredient_breakdown`, `story`,
  `taste_profile`, `perfect_pairings`, `related_items`, `mood_tags`) + badges
  (`signature`, `guest_favorite`, `trending`, `happy_hour`, `discount`, `seasonal`,
  `limited_time`, `new_item`, `custom`). Each enable/disable/**schedulable**.
- Badges are **manual** (owner-forced, optionally scheduled) or **auto** (activated from
  analytics — `guest_favorite`, `trending`). `resolveBadges()` + `isModuleActive()`. (8 tests)
- Persistence: `menu_experience` table (migration 0008) — keyed by SLUG because the live
  menu is static in-code (the `cocktails` table is empty). Admin Builder edits it; the diner
  app reads it via `useMenuConfig` (falls back to in-code defaults). Verified PUT/GET E2E.

### 4.3 Promotions Engine — `src/lib/promotions/` + `/admin/promotions`
- Discounts: `percentage` | `fixed`; scope `item` | `category` | `all`; scheduled.
- `priceFor()` picks the lowest active price; `promotionBadges()` — **each active promo is
  the single source of truth for its badge** (badges read the schedule, never duplicate it). (8 tests)
- Persistence: `promotions` table (migration 0007). Public read, admin write (service-role).
  **Verified end-to-end against the live DB: create → list → delete, no residue.**

### 4.4 Menu Optimization (Recommendation) layer — `src/lib/optimization/` + `/admin/optimize`
- `buildRecommendations(menuEngineeringItems, opts)` → one prioritised `Recommendation` per
  item: `fix_offer` (conversion leak), `promote_position` (puzzle), `raise_price`
  (plowhorse — with a DERIVED `≈ +₪X` estimate = units × ₪3 test bump), `review_or_remove`
  (dog), `keep_position` (star). Each has `headline`, `rationale`, `confidence`,
  optional `estimatedImpact`. (9 tests)
- **Integrity gate in code:** `estimatedImpact` is emitted only when derivable AND
  `confidence !== 'low'`; leaks/position recs deliberately carry **no** number (need an A/B
  test). Confidence is derived from item view count (sample size).
- `/admin/optimize` also shows **actual sales** (units/₪) per item when sales exist.

### 4.5 Diner discovery (Guest Experience)
- **Badges + auto promo pricing** on menu cards (`MenuBadges`, resolved in restaurant tz).
- **"Guests also viewed"** (`AlsoViewed`) — data-driven cross-sell from real co-view data
  (`/api/analytics/recommendations`); renders nothing without data.
- **Mood filter** ("What suits me now?") — `sweet/sour/refreshing/strong/herbal` derived from
  the flavor profile (`src/lib/mood.ts`, 6 tests).
- **Top Picks** — Most Viewed + Hidden Gem from analytics; hidden without data.
- **Time-of-day hint** — "Perfect for sunset" / "Nightcap hour" etc. (restaurant tz).
- **Per-cocktail stories** (`CocktailStory`) — short evocative copy, the "emotion" layer.

### 4.6 Read-only sales ingestion — `src/lib/sales/` + `/admin/sales`
- CSV paste (`slug,units,revenue`) + period → `sales` table (migration 0009).
- Aggregated by slug; surfaced in `/admin/sales` and `/admin/optimize`.
- **Members-only RLS** (sales are private revenue data). Verified import → read → cleanup E2E.

### 4.7 Attention Heatmap — `SectionAttention` + `src/lib/analytics/heatmap.ts` + `/admin/heatmap`
- `SectionAttention` wraps sections (ingredients / flavor / story) and uses
  `IntersectionObserver` to measure real dwell (≥0.8s visible), firing ONE
  `section_attention` event with `{section, dwellMs}` on exit/unmount.
- `getAttentionHeatmap()` aggregates by section (count + avg dwell) → `/admin/heatmap`
  ("which part drew the eye"). Populates as real diners scroll.

---

## 5. Data model & migrations

| Migration | Adds | RLS |
|-----------|------|-----|
| `0006_visitor_id` | `events.visitor_id` column + backfill | (existing events policies) |
| `0007_experience_promotions` | `cocktails.experience_config` (unused — table empty) + **`promotions`** table | public read, member write |
| `0008_menu_experience` | **`menu_experience`** (per-slug ExperienceConfig) | public read, member write |
| `0009_sales` | **`sales`** (units/revenue/period per slug) | **members only** (private revenue) |

All four migrations have been **applied** to the live DB and verified by the app.
`src/lib/supabase/types.ts` (hand-written `Database` type) was extended with the 3 new tables.

**Important architectural note:** the live diner menu is **static in code** (`MENU` in
`src/data/cocktail.ts`); the `cocktails` table is empty. So per-item experience config is
stored keyed by slug in `menu_experience`, and promotions/sales target cocktails by slug.

---

## 6. Key files

**New libs:** `src/lib/scheduling/*`, `src/lib/experience/*`, `src/lib/promotions/*`,
`src/lib/optimization/*`, `src/lib/sales/repository.ts`, `src/lib/analytics/heatmap.ts`,
`src/lib/mood.ts`, `src/lib/timeOfDay.ts`, `src/lib/useMenuConfig.ts`, `src/lib/supabase/restaurant.ts`.
**New components:** `MenuBadges`, `AlsoViewed`, `MoodFilter`, `TopPicks`, `TimeOfDayHint`,
`CocktailStory`, `SectionAttention`.
**New data:** `src/data/experience.ts` (starter config + diner resolvers), `src/data/stories.ts`.
**New API routes:** `/api/promotions`, `/api/experience`, `/api/sales`, `/api/analytics/heatmap`.
**New admin pages:** `/admin/optimize`, `/admin/experience`, `/admin/promotions`,
`/admin/sales`, `/admin/heatmap` (+ nav links in `AdminShell`).
**Modified:** `OrderBar.tsx` (→ My Picks), `MenuCard.tsx`, `CocktailScene.tsx`,
`MobileCocktailScene.tsx`, `page.tsx`, `tracking/taxonomy.ts` (+`section_attention`),
`supabase/types.ts`, `package.json` (vitest), `CHANGELOG.md`.
**Deleted:** `Cocktail360.tsx`, `Cocktail3D.tsx`, `Spin360.tsx`, `src/app/spin/`.

---

## 7. Verification performed

- **Unit tests:** 41 passing (scheduling 10, experience 8, promotions 8, optimization 9, mood 6).
- **Typecheck:** `npx tsc --noEmit` clean after every change.
- **Build:** `npx next build` green after every change.
- **Deploys:** multiple `vercel --prod` deploys; all pages return 200.
- **DB E2E (against live Supabase):**
  - Promotions: POST → GET → DELETE, count back to 0 (no residue).
  - Experience: PUT → GET round-trip.
  - Sales: POST import → GET aggregated → service-role cleanup.
- **API smoke:** `/api/analytics/{menu-engineering,recommendations,heatmap}`,
  `/api/{promotions,experience,sales}` all return `success:true` (heatmap empty until traffic).

---

## 8. Known limitations / honest gaps

1. **Client-clock for diner badges:** the menu is a client component, so badge/price
   resolution currently runs client-side (after mount). The plan calls for server-side
   resolution in the restaurant tz; this should move server-side when the menu does.
2. **Experience module toggles** are wired into the data model + builder + diner read, but
   only the **mobile** scene gates some sections; the desktop scene doesn't yet hide modules.
3. **Heatmap section coverage:** instrumented on mobile (ingredients/flavor/story). Desktop +
   video/price sections not yet wrapped.
4. **Auth:** admin write APIs are not gated behind member auth yet (noted as Phase 2 in code);
   they use the service-role server-side. Fine for a single-tenant demo, must be gated before
   multi-tenant.
5. **Recommendation rules** are heuristic (menu-engineering class + leak flag). They do not
   yet *consume* real sales to recompute conversion — sales are displayed alongside, not fused
   into the rule engine.
6. **Empty-config fallback:** if the owner deletes all DB promotions/experience, the diner
   menu falls back to in-code defaults (so the demo never looks empty). Intentional for demo;
   revisit for production ("owner intends zero promotions").
7. **Security:** Supabase `service_role` + DB password rotation still recommended.
8. **Git:** most of the app is currently untracked in git (only ~24 files tracked).

---

## 9. Current state

The Menu Intelligence plan is **complete**: all three layers live, migrations 0006–0009
applied, 41 tests green, deployed. Admin screens: optimize · experience · promotions · sales ·
heatmap (+ existing analytics / menu-engineering / tables / journeys / signals / experiments /
crm / executive / events). Diner: luxury menu, videos, badges, promos, stories, mood filter,
Top Picks, time-of-day, "guests also viewed", My-Picks intent.

Full plan + rationale: `docs/MENU_INTELLIGENCE_PLAN.md`. Shipped history: `CHANGELOG.md`.

---

## 10. Review questions for GPT (what to scrutinise)

1. **Strategy:** Is "intelligence layer above the POS (Tabit), never an ordering system" the
   right wedge? Any risk we're leaving too much value on the table by not touching ordering?
2. **Integrity gate:** Is "no numeric estimate unless derivable + sufficient confidence" the
   right bar? Is deriving the plowhorse estimate as `units × ₪3` defensible, or too crude?
3. **Conversion denominator:** Is read-only sales ingestion (CSV) the right v1, or should we
   prioritise a Tabit/POS read integration sooner? Should recommendations *fuse* sales into
   the rule engine now (recompute real conversion) rather than only displaying them?
4. **Scheduling core:** Any correctness edge cases in the timezone/midnight-spanning/seasonal
   logic? (DST transitions, week-boundary for spanning windows.)
5. **Data model:** storing experience config keyed by slug in `menu_experience` (because the
   menu is static) vs migrating the static menu into the `cocktails` table — which is right
   long-term?
6. **RLS / auth:** admin writes via service-role with no auth gate yet — acceptable for now?
   Priority to add member auth?
7. **Diner UX restraint:** do badges + mood filter + Top Picks + time-of-day + stories risk
   cluttering the "luxury = minimal" aesthetic? What would you cut?
8. **Heatmap signal quality:** is `section_attention` (IntersectionObserver dwell ≥0.8s, one
   event per mount on exit) a sound measure, or biased (e.g., long pages, fast scrollers)?
9. **What's missing** from a "Menu Optimization" product that a restaurant would pay monthly for?
