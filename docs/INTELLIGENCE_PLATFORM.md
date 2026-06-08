# From Digital Menu → Restaurant Intelligence Platform

**Redesign roadmap.** Transforms the admin system from a *menu builder* into a
*business-intelligence platform* for restaurant owners. Grounded in the existing
codebase (Next.js 16 · React 19 · TS strict · Supabase Postgres + RLS).

---

## 0. The shift

| Today (menu builder) | Target (intelligence platform) |
|---|---|
| Compose menu, generate art, print QR | Measure attention, conversion, profitability |
| Demo analytics (`pseudoRandom`) | Real event-driven KPIs |
| "Here is my menu" | "What should I promote, remove, reprice?" |

The product value moves from *making a pretty menu* to *making the owner more money*.

---

## 1. What already exists (de-risks the build)

- **`events` table is already in Supabase** (migration `0001`): `restaurant_id`,
  `cocktail_id`, `event_type`, `metadata jsonb`, `session_id`, `created_at`, with
  indexes `(restaurant_id, created_at desc)` and `(cocktail_id, event_type)`, and
  RLS allowing **anonymous insert** / member-only select. *No app code writes to
  it yet.*
- **`priceILS` exists** on all 9 cocktails and as `price_ils numeric` in the DB.
  Missing only `costILS` (needed for margin / menu-engineering).
- **Store + observability patterns** to mirror: `src/lib/store/*` (repository
  interface + adapter selection + `instrument()`), `src/lib/observability/events.ts`
  (taxonomy + `OpContext` + `newRequestId`). There is **no `track()` yet**.
- **Multitenancy is schema-ready but app-hardwired to `'diner'`**; there is **no
  `table_id` concept** anywhere — greenfield.
- **Analytics page** (`src/app/admin/analytics/page.tsx`) is 100% demo data; its
  `KpiCard` + `Sparkline` components are reusable as-is.

---

## 2. Target architecture

### Ingestion path
```
Diner browser
  └─ useTracker() → track(payload)            (tiny client SDK, <3KB, no deps)
       └─ queue (batch ~5s / on visibilitychange)
            └─ navigator.sendBeacon('/api/track', batch)
                 └─ /api/track (server route, Zod-validated)
                      └─ service-role insert → events            (Supabase)
```
**Diners never write directly** with the anon key (today's `with check (true)`
lets anyone forge any restaurant's events). All writes go through `/api/track`
which validates, resolves `restaurantSlug → uuid`, clamps clock skew, and inserts
with the service-role key. Then tighten RLS to deny anon insert.

### Aggregation
Raw `events` = append-only truth; **read paths never scan raw at runtime**:
- **Postgres views** for low-volume real-time slices (one cocktail's funnel).
- **Materialized rollups** (`item_daily_rollup`, `funnel_daily`, `table_daily`)
  refreshed by **Supabase `pg_cron`** (every 5–15 min) — *not* Vercel cron
  (avoids Hobby's no-cron / function limits). **Key decision: aggregate inside
  Postgres.**
- Prune raw `events > 90 days` post-rollup.

### Privacy model (no sensitive PII)
- `session_id` = `crypto.randomUUID()` in `sessionStorage` (per-session).
- `visitor_id` = opaque id in `localStorage` (for "returning visitor" CRM) — no
  email/phone/IP, no fingerprinting, no cross-site.
- `table_id` = QR query param `?t=<table>` (preserved through `scan/page.tsx`).
- Coarse `device_type` only (mobile/tablet/desktop); never raw UA or IP.
- Anonymous, legitimate-interest analytics → no cookie banner; `track()` respects
  a Do-Not-Track / opt-out no-op.

---

## 3. Data model additions

### `CocktailConfig` (TS) — add
- `costILS?: number` (→ `cost_ils numeric` on `cocktails`); `priceILS` already exists;
  `marginILS` computed.

### Event taxonomy — `src/lib/tracking/taxonomy.ts`
```ts
export type TrackEvent =
  | 'menu_opened' | 'menu_closed' | 'menu_shared' | 'language_changed'
  | 'cocktail_impression' | 'cocktail_opened' | 'cocktail_scrolled_to'
  | 'cocktail_fully_viewed' | 'cocktail_shared' | 'cocktail_favorited'
  | 'ingredients_opened' | 'ar_opened' | '360_opened'
  | 'call_waiter_clicked' | 'add_to_order_clicked' | 'order_started'
  | 'order_completed' | 'reservation_clicked' | 'phone_clicked' | 'whatsapp_clicked';

export interface TrackPayload {
  event: TrackEvent;
  cocktailSlug?: string;
  value?: number;                       // scroll %, dwell ms, score delta
  metadata?: Record<string, unknown>;
}
```

### Migration `0004_intelligence.sql` (Phase 1 portion)
- Widen `events`: add `event_name text`, `table_id text`, `device_type text`,
  `language text`, `referrer text`, `value_num numeric`, `occurred_at timestamptz`
  (drop the narrow `event_type` CHECK — additive, old rows still valid).
- Indexes: `(restaurant_id, occurred_at desc)`, `(cocktail_id, event_name)`,
  `(session_id)`, `(restaurant_id, table_id, occurred_at)`, BRIN on `occurred_at`.
- Tighten RLS: anon insert → **denied**; insert via service-role only.
- `cocktail_funnel` view: Seen → Opened → Ingredients → Breakdown → Called → Ordered.
- `cocktails.cost_ils numeric`.

### Later migrations (by phase)
- `sessions(session_id pk, restaurant_id, visitor_id, first_seen, last_seen, table_id, language, device_type)` — CRM/attention without scanning raw.
- `item_economics(cocktail_id pk, cost_ils, price_ils, margin_ils generated)`.
- `ab_experiments` + `ab_assignments` (A/B).
- `ai_insights(id, restaurant_id, kind, body_md, evidence jsonb, dismissed)`.
- `staff_actions` (waiter response time — needs waiter surface).

---

## 4. Phased roadmap (sequenced by dependency)

| Phase | Priorities | Deliverables | Key new/edited files |
|------|-----------|--------------|----------------------|
| **1 · Foundation: Event spine** | **P1** | taxonomy union, `track()` + queue + session, `/api/track`, migration `0004`, `?t=` table capture, events wired into menu/cocktail/AR/360 | `src/lib/tracking/*`, `src/app/api/track/route.ts`, `0004_intelligence.sql`, edits to `scan`, `cocktails/[slug]`, `app/page.tsx` |
| **2 · Real KPIs + Funnel** | **P2, P11** | `cocktail_funnel` view, `item_daily_rollup`, analytics repo, rewrite analytics page from demo → live | `src/lib/analytics/queries.ts`, `src/app/admin/analytics/page.tsx` |
| **3 · Scoring + Engineering** | **P3, P4, P5** | Attention Score 0–100, Star/Puzzle/Workhorse/Dog, table heatmaps | `src/lib/analytics/scoring.ts`, `admin/menu-engineering/page.tsx`, `admin/tables/page.tsx`, `cost_ils` |
| **4 · Experiments + AI** | **P7, P8, P9, P12** | A/B engine (uplift + z-test confidence), co-view recommendations, AI insights (Claude structured output), executive summary | `src/lib/experiments/*`, `analytics/recommendations.ts`, `api/insights/route.ts`, `admin/executive/page.tsx` |
| **5 · CRM + Staff** | **P6, P10** | returning-visitor / frequency / peak-hour signals, waiter response metrics | `analytics/crm.ts`, `admin/crm/page.tsx`, waiter app stub |

**Attention Score** = weighted blend of dwell + scroll depth + ingredient opens +
repeat views + hovers/zooms, normalised 0–100, computed in rollup SQL.
**Menu engineering** = `item_economics` margin × demand percentile → quadrant +
recommendation ("move higher", "increase visibility", "reprice", "QR campaign").

---

## 5. First concrete slice (build this first)

Goal: a **real** Seen→Opened→Ingredients funnel for one cocktail, end-to-end —
proves the whole pipeline before scaling to the other 11 priorities.

**Create:** `0004_intelligence.sql` · `src/lib/tracking/{taxonomy,session,track,queue,useTracker}.ts`
· `src/app/api/track/route.ts` · `src/lib/analytics/queries.ts` (`getCocktailFunnel(slug)`).
**Edit:** `scan/page.tsx` (keep `?t=`) · `cocktails/[slug]/page.tsx` (fire opened /
ingredients_opened / fully_viewed) · `app/page.tsx` (menu_opened / impression) ·
`admin/analytics/page.tsx` (one live funnel card beside the demo KPIs).

---

## 6. Risks / tradeoffs

- **Vercel Hobby:** no reliable cron, 10s/300s caps → aggregate in **pg_cron**, keep
  `/api/track` sub-second.
- **RLS:** current anon `with check (true)` is forgeable → move writes to
  service-role route, deny anon insert.
- **Event volume:** dedupe impressions per item/session, batch, BRIN index, prune >90d.
- **Bundle:** tracking SDK <3KB, native `sendBeacon`/`crypto.randomUUID`, no vendor SDK.
- **Live DB:** migration `0004` alters the production Supabase schema + RLS — apply
  deliberately (review before running).

---

## 7. Open decisions (need owner input)

1. **Order/POS integration** — are `order_started/completed` fired by *us* (an
   in-app "Add to order" flow) or imported from an external POS? Determines whether
   conversion is true revenue or intent.
2. **Multi-tenant timing** — keep `'diner'` hardwired for now, or parameterize
   `restaurantSlug` (URL/auth) as part of Phase 1?
3. **Staff/waiter surface** (Phase 5) — is there an existing waiter workflow to
   measure response time against, or do we build a minimal waiter app?
4. **Migration approval** — green-light applying `0004` to the live Supabase?
