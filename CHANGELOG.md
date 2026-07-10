# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2026-07-10] — Tenant-isolation gate + measurement honesty + observability (LIVE in production)

### Security — Tenant-scoped analytics reads (B5 · sec-review H3, the gate before tenant #2)
- The analytics lib functions were already restaurant-parameterized and `restaurant_id`-filtered, but **every guarded read route discarded the session and fell back to the `'diner'` default** — a second tenant's logged-in user would have seen diner's data. Every guarded read route now passes `session.restaurantSlug`: overview, menu-engineering, crm, executive, heatmap, opportunities, sessions, `events/raw`, `events/integrity`, `signals/verify`, `experiments/results` (funnel · tables · closed-loop already did). `getExecutiveSummary` threads the slug into its internal calls. Verified: **zero unscoped `events` reads** across analytics libs; only the 3 non-tenant admin writes keep a bare guard. Gate for onboarding tenant #2 is cleared.

### Security — No internal-error leakage + structured server logging (sec-review M2)
- New `src/lib/log.ts`: minimal structured JSON logger (`level`/`scope`/`ts`) on stdout/stderr — what Vercel log drains ingest. Wired at the two seams that observe the whole API surface: `guard.unauthorized()` now logs every guarded route's unexpected 500 **in full server-side** while returning a **generic `internal error`** to the client (raw SQL/table/constraint messages no longer leak in response bodies); `/api/track` logs ingest failures with slug + batch size and returns a generic `ingest failed`. Auth 401 path unchanged; the tracking client only inspects status codes, so keep-and-retry still works.

### Fixed — Honest confidence, derived from real sample (F6)
- Deleted the fixed `{low:58, medium:74, high:91}` confidence lookup that powered the AI Coach / Action Center. `confidencePct` now derives from the **real observed sample** (the item's drink-page views) via the funnel engine's saturating curve `n/(n+60)`, shaped by qualitative separation and capped at 95 — 100 views can no longer claim 91% certainty, and no data honestly reads as 0%. Tests updated + monotonicity test.

### Fixed — Low-sample rate gate (F4)
- A conversion/order-rate % computed from a tiny denominator ("100% ordered" from 2 views) fabricates confidence. New `src/lib/analytics/rate.ts` (`hasConfidentSample`/`confidentRate`, gate = 25 distinct views — the display twin of closed-loop `insufficient_data`). Applied uniformly to every order-rate display (House Performance KPI, Menu Analysis item cards, Analytics KPI + table): the exact stored percentage still shows once the sample clears the gate, otherwise a muted `—`. Stored/aggregate math is unchanged. 7 tests.

### Security — Hardening pass (audit-driven)
- **SSRF guard.** The restaurant scraper fetched a user-supplied URL with default redirect-following and no IP filtering — an authenticated caller could reach `169.254.169.254` (cloud metadata → credential theft) or any internal/RFC-1918 host. New `src/lib/net/ip.ts` (pure, tested classifier: RFC-1918/6890 + metadata + IPv6 ULA/link-local/mapped) and `src/lib/net/ssrf.ts` (`safeFetch`: resolves the host, refuses blocked addresses, follows redirects **manually re-validating every hop**, 10 s timeout). 8 classifier tests.
- **Path traversal.** `generate-breakdown` interpolated `body.slug` straight into a server filename; `slugify()` now confines it to `[a-z0-9-]` so `../../` can't escape the output dir.
- **Ingest abuse caps.** The public, unauthenticated `/api/track` now rejects oversized bodies (64 KB → 413) before parsing and refuses explicit cross-site fetches (403), without blocking same-origin `fetch`/`sendBeacon`. (Durable per-IP rate limiting needs KV — tracked as follow-up.)
- **Secret + headers.** Server route no longer falls back to the browser-bundled `NEXT_PUBLIC_POLLINATIONS_TOKEN`; `esc()` now escapes single quotes; baseline security headers added in `next.config.ts` (nosniff · referrer-policy · permissions-policy globally; `X-Frame-Options: DENY` + noindex on `/admin/*`).

### Accessibility — WCAG pass on the premium surfaces
- **Reduced motion (root cause).** `<MotionConfig reducedMotion="user">` now wraps the whole app, so **every** Framer Motion component honours the OS "reduce motion" setting (including screens applying the shared `staggerContainer`/`staggerItem` variants); `Reveal`/`Stagger`/`AdminShell`/`MenuRow` also gate locally.
- **Focus & keyboard.** The launcher and Media Library overlays now move focus into the dialog on open, trap Tab, restore focus on close, and close on Escape. `AdminTabs` implements the full ARIA Tabs pattern (`role="tablist"/tab/tabpanel`, `aria-controls`, roving `tabindex`, Arrow/Home/End nav) — verified live. Language toggle gains `aria-pressed`; Media Library source chips become a labelled `tablist`; the Settings restaurant-name input gets a real associated `<label>`.

### Fixed — Resilient async states (error ≠ empty)
- Every admin data screen conflated fetch failure with "no data yet", so an outage looked identical to a brand-new restaurant — and two screens had unhandled promise rejections. New shared `ErrorState` primitive (distinct rose alert + retry); wired across **10 screens** (promotions, closed-loop, experience, sales, recommendations, wins, executive, menu-engineering, experiments, analytics) so a failure now shows a retryable error, never a misleading empty/zeroed state. `promotions.load()` and `closed-loop.submitManual()`/`experience.save()` gained the missing try/catch.

### Fixed — Honest claims when the dataset is thin (F5, across all engine surfaces)
- Owner/expert engine surfaces presented findings with full confidence even before there's enough data to trust them. They now surface the existing signal-readiness gate as a **non-blocking caveat** whenever the dataset isn't ready (≥500 events · 95% coverage · 7 consecutive ready days). Built as **shared primitives** — `useReadiness()` (`src/lib/useReadiness.ts`, fetched once, fails open) + `<ReadinessNote tone="owner"|"expert">` (`src/components/ui/value.tsx`) — so every surface tells the same honest story with no per-screen copy drift. Wired into the **AI Coach** and **Action Center** (owner voice: "Still learning your guests…") and the **Executive summary** (expert voice: "Signal readiness X/7…"). Additive — findings still show, just honestly framed. Verified live (caveat renders for the sparse tenant).

### Added — Security test coverage
- `slugify` (the filename sink guard behind the generate-breakdown path-traversal fix) now has tests locking in that `../../etc/passwd` → `etcpasswd` (no separators survive). Complements the SSRF IP-classifier tests.

### Added — Resilience & monitoring (never white-screen; catch outages early)
- **App Router error boundaries + branded 404.** The app had none — an uncaught render error white-screened the user in production. Added a shared on-brand `ErrorScreen` (bilingual, retry + back-to-menu) wired into `app/error.tsx` (route), `app/admin/error.tsx` (admin), `app/global-error.tsx` (root-layout last resort, self-contained), and `app/not-found.tsx` (branded 404). All log the error + surface the digest as a support ref. Verified live (`/_not-found` renders).
- **Error ≠ empty, completed.** `home` (House Performance) was the last data screen masking failure as "no data yet"; it now shows a page-level `ErrorState` + retry only on a total outage (all fetches null), keeping partial data graceful. All 11 data screens now distinguish error from empty.
- **Reduced motion, completed.** The global `MotionConfig` covered Framer, but the 3D scenes' R3F `useFrame` loops ignored `prefers-reduced-motion`. `CocktailLayers` (idle float bob) and `LuxuryLighting` (light drift) now still for motion-sensitive guests while keeping user-controlled pointer sway. Coverage complete across Framer + WebGL.
- **Health check.** New public `/api/health` pings Supabase and returns `200 {status:ok, db:ok, ms}` / `503 {db:down}` — the early-warning an uptime monitor needs for the free-tier auto-pause (today's first signal is guests hitting "failed to fetch"). Reveals only up/down. Verified live (200, db:ok, 71 ms).

**Verification:** `tsc` + **196 tests** + `next build` (57 pages) green; shipped in **eleven verified deploys**. Live checks: public menu 200 + no console errors, auth works, AdminTabs ARIA correct in-browser, launcher focus+Escape confirmed, security headers present, same-origin tracking still 200, readiness caveat renders on engine surfaces, branded 404 renders, `/api/health` 200 db:ok. Parked: A5 secret rotation + durable `/api/track` rate limiting + Pollinations server-proxy (need dashboard/KV — filed as a follow-up task), a global text-contrast bump (aesthetic review), Epic F F2–F3, H-B (wire AI to real data).

---

## [2026-07-06] — Multi-tenant foundation + premium redesign (LIVE in production)

### Security — Multi-tenant foundation (Epics A+B+C+D)
- **Authentication enforced.** `requireSession()` guards every admin `/api/*`; `/admin/*` is gated behind login (`AUTH_ENFORCED=true`, live). Public diner paths (`promotions`/`experience`/`analytics-recommendations` GET, `/api/track`) stay open by design.
- **Tenant isolation.** Tenant is now session-derived — killed the `?restaurant=` cross-tenant write leak; admin writes run through a user-scoped client so **Supabase RLS is the live boundary**. Migrations `0007`/`0008`/`0011` applied (restaurant_type, event idempotency index, owner→diner membership seed).
- **Reliable data pipeline.** At-least-once event queue (localStorage persist + retry/backoff + `sendBeacon`) + server idempotency (`event_id` upsert `ON CONFLICT DO NOTHING`) = exactly-once effect; provenance stamps (`eventVersion`/`eventSource`/`uiVersion` + `restaurantType`/`menuCategory`) on every event; content-addressed recommendation provenance envelope.

### Added — Premium redesign "Obsidian & Champagne" (presentation layer, zero logic change)
- Design system + primitive library (`src/components/ui/premium.tsx`): `GlassCard`, `CtaPill`, `StatBlock`, `EmptyState`, `AmbientBackdrop`, `GlowDivider` — obsidian neutrals, champagne accent, glass surfaces, cinematic motion.
- Glass capsule nav + cinematic launcher (`AdminShell`/`AdminLauncher`); flagship `/admin/home`; image-forward public menu (double-size featured tiles + glass footers in `MenuRow`); cinematic AI screens; full restyle of ~24 admin screens.
- **Media library** (`MediaLibrary`) — Figma/Lightroom-style hero-image picker (Menu · Drafts · Upload · Recent, live search, drag-drop, 4 MB cap), wired into `CocktailForm` via the existing `setHeroUrl`.
- Global RTL fix (`DirectionSync`) — `<html dir/lang>` follows the UI language on every page.

### Changed — Admin IA consolidation (23 launcher entries → 6 destinations + Advanced)
- Reorganised into 6 primary destinations + a persisted **Advanced** toggle: **Act** (Home · Today · Results), **Menu & Promotion**, **Insights**, **Tools**, and a hidden **Advanced** group (Executive · A/B · Inspector · Signals · Build Log).
- New tabbed destinations (`AdminTabs`, lazy per-tab mount): `/admin/today` (briefing · actions · opportunities), `/admin/results` (closed-loop · wins), `/admin/promote` (promotions · experience · pairings), `/admin/tools` (QR · sales + print/kiosk links). Inner content extracted as `*Panel` named exports — **every original route still resolves** (no bookmarks broken).

### Fixed — Honest closed-loop measurement (F1)
- `measureImpact` no longer fabricates wins: `too_early` until a COMPLETE equal-length post window elapses (a partial post vs full pre window is what let a volume drop read as a "+% win"); `insufficient_data` on a zero/tiny baseline; `no_effect` below the noise band / minimum absolute delta. 5-status engine wired end-to-end (types → server confidence → closed-loop UI labels); 10 tests.

### Added — Dev / verification scripts
- `scripts/audit/` — live verification harnesses (auth-boundary 401 probe, idempotency, membership seed, segment stamping). They read secrets from the gitignored `.env.local`; none are hardcoded.

**Verification:** `tsc` + **167 tests** + `next build` (57 pages) green; production probed (public 200 · gated APIs 401 · `/admin/*` → login). Parked: Epic F F2–F6, follow-up B5 (tenant-scope analytics reads before tenant #2).

---

## [Unreleased] — 2026-06-09

### Added — Netflix-style sectioned menu (the public landing)

The flat card grid is now a **cinematic, sectioned menu**: a hero (restaurant name +
featured image + search) over **horizontal, snap-scrolling rows** — one per food course
(ראשונות → עיקריות → קינוחים, ordered like a real menu) plus a **Cocktails** row for all
drinks. Image-forward cards (`MenuRow`/`RowCard`) with the emotional badges and hover video;
food cards open the food experience (`/drafts`), drinks the cinematic one (`/cocktails`).
Search filters within rows; per-card impression tracking and scroll-memory preserved.

### Added — Food guest experience (a dish, not a drink)

The cocktail page now dispatches by `kind`: a food item renders a **FoodExperience** —
big plated image (no glass reflection), course eyebrow, name, price, the full
description (for food this IS the components), dietary badges (vegan / gluten-free),
optional video, and "you might also like". **No** glass, **no** exploded-ingredient
view, **no** flavor-profile radar, **no** "tap to explore". Drinks keep the cinematic
cocktail layout unchanged. Draft preview (`/drafts/[slug]`) now uses the same Experience,
so imported food items preview correctly (instead of the old 3D cocktail scene).

### Added — Drink vs food: type-aware editing

Menu items are no longer assumed to be cocktails. Each item has a `kind` (`drink` |
`food`); imports detect it from the menu section (`inferKind`, e.g. "המבורגרים" → food,
"בירות" → drink) and store the section as `course`.
- **Editor** — a **Drink / Food** toggle. For food the cocktail-only fields disappear:
  the citrus/smoky **category** becomes a free **"Menu section / course"** field
  (prefilled from the import), the **flavor-profile radar** is hidden, and "Bartender
  note" becomes **"Chef note"**. Price / description / image / dietary stay for both.
- Code-defined cocktails (no `kind`) still default to drink — the existing menu is unchanged.

### Fixed — Menu import now keeps price + description

- **Scraper (getmood.io)** — was matching `"NN shkalim"` for price (but the real markup is
  `<div class="menuModuleTextItemPrice">96<span>shkalim</span></div>`) and `<p>` for the
  description (it's a `<div class="menuModuleTextItemDescription">`). Switched to the stable
  class selectors → price + description now extract. (Verified on a real 75-item menu:
  75/75 prices, 46/75 descriptions.)
- **Import** — the price was dropped entirely; now parsed to `priceILS` on the draft (and the
  description still flows to the tagline). The selection list shows a **₪ price** column and the
  results cards show the price.
- **Editor** — added a **Price (₪)** field (the form had none), so price is editable like the
  tagline/description.

### Added — Menu import: category groups · description · per-item ChatGPT prompt + edit

Reworked the import flow into a self-serve "import → edit → add image" loop:
- **Grouped selection** — scan flattens the whole menu and shows items grouped under
  the restaurant's OWN categories (preserved from the scrape), with per-group and
  global select-all/none. Descriptions are kept and become each item's tagline.
- **Results screen** (no more auto-redirect) — every imported item shows a ready
  **ChatGPT image prompt** (copy button) + an **Edit · add image** link straight to
  its editor. "needs a photo" flag when the image is a placeholder.
- **Editor** — new "Make the image in ChatGPT" box (readonly prompt + Copy) next to the
  existing AI-generate / upload controls. Shared `buildGptImagePrompt()` (drinks + food).
- **Fix** — Hebrew (non-ASCII) draft slugs now resolve in `/admin/[slug]/edit` and
  `/drafts/[slug]` (decode the URL-encoded route param; idempotent for ASCII).

### Added — Cocktail Experience: guest recommendations + full-menu rollout

- **"Guests also explored" strip** below the flavor profile in the ingredient view:
  up to 3 other drinks (image · name · price → their page). Honest two-tier source —
  real co-view data from `/api/analytics/recommendations` ("Guests who opened this also
  explored…"); curated same-category fallback labelled as a plain suggestion ("You might
  also like") when a drink has no behavioral data yet. Analytics failures never break the page.
- **Rolled out to all 9 cocktails** — `EXPERIENCE_SLUGS` gate removed; every
  `/cocktails/[slug]` now renders the full-screen Experience. Drinks without a feature
  video get a single full-width Ingredients action (no disabled tile).

### Added — Cocktail Experience prototype (Aperol Spritz only)

Full-screen cinematic drink page (`CocktailExperience`) inspired by luxury-spirits sites:
hero drink at ~56vh with glow + reflection, name + one-line tagline + price, exactly three
actions (Ingredients / Video / AR — AR highlighted and pinned top), an exploded ingredient
view (numbered components float above the glass, bilingual one-liners from the existing
labels), and a cinematic video mode (feature mp4, muted, no loop, returns to hero). Reusable
and config-driven; gated to `diner-aperol-spritz` via `EXPERIENCE_SLUGS` while we evaluate.
Funnel intact: fires the same `cocktail_opened` / `ingredients_opened` /
`cocktail_video_opened` / `ar_opened` / `order_started` events.

### Added — Emotional Layer (hospitality voice · briefing copy · celebration)

Give the platform personality so it feels built by restaurant operators, not software
engineers. Verified (`tsc` + `next build` clean, 92 tests / 13 files green) and deployed.
- **Hospitality renaming:** _Revenue Center_ → **House Performance** (ביצועי הבית);
  _AI Coach_ → **Shift Briefing** (תדריך המשמרת). Routes unchanged; nav + screen titles updated.
- **Consultant voice — `buildBriefing()`** (`lib/value/briefing.ts`): turns each opportunity
  type into a 2-sentence story about what's happening in the room ("Guests keep finding X — but
  it sits low on the menu… the interest is real; the visibility isn't") instead of a metric dump.
  Bilingual, honest (no fabricated figures). The **Shift Briefing** screen now leads with this
  advisor narrative; the ₪ estimate + confidence support it below.
- **Celebration kit — `components/ui/celebrate.tsx`:** `Confetti`, `VictoryRing`,
  `CelebrateOnTrigger` — deterministic (no `Math.random` ⇒ no hydration drift), `prefers-reduced-motion` safe.
- **Hall of Wins** now feels like a win: confetti + glow ring on the top win, "🎉 Success" framing,
  a "Best result this week" crown, warmer forward-looking empty state — still measured-only, no invented numbers.
- **Action Center** fires a confetti burst + honest reinforcement on Done ("Nice — that's about
  ₪{est} of upside now in motion" / "Done. One less thing on the pass." when value isn't estimable).

### Added — Backlog completion (editor polish · CMS reorder · public motion · tests)

- **Cocktail editor** restyled to the luxury language (CocktailForm + new/edit); the edit route now falls back to the published MENU cocktail (prefill) instead of dead-ending on "not found".
- **Composer reorder:** drafts drag-to-reorder (localStorage); **published-menu drag-to-reorder** via a new `useMenuOrder` hook (persisted, per-device) — reflected on the guest menu with a safe identity fallback (no custom order ⇒ unchanged), plus a "Custom order · Reset" control.
- **Import** progress stepper; **QR/Print** brand-accent theming (print fidelity preserved).
- **Public screens:** additive entrance motion (menu filter blocks, kiosk hints) — no double-animation (MenuCard already self-animates by index).
- **Tests:** vitest unit tests for `eventTypeLabel`/`deviceLabel`, `deltaPct`, and `applyOrder` — 76 tests across 10 files, all green.

### Added — Visual upgrade sprints (motion · real charts · action features · bespoke viz)

Four sprints raising the whole admin surface to "highest quality", each verified (`tsc` +
`next build` clean) and deployed:
- **Sprint A — Level-Up Pack (global):** entrance fade-in on all admin content (`AdminShell`),
  count-up KPI numbers + unified hover (`KpiCard`), shimmer `Skeleton`/`SkeletonGrid` loading
  states replacing "Loading…" text, `LiveDot` on polling screens, card stagger on primary grids.
  New shared primitives in `dataviz.tsx` + `components/ui/motion.tsx`; `shimmer` keyframe +
  `prefers-reduced-motion` guard in `globals.css`.
- **Sprint B — Real charts:** smooth SVG `AreaChart` (gradient fill, glowing end-dot, responsive)
  replaces CSS-bar sparklines everywhere (incl. KpiCard); Analytics dual area-chart (views/orders)
  + client-side period selector (7d/14d/All); Executive demand-trend + Home traffic chart.
- **Sprint C — From word to action:** Executive AI "morning briefing" (deterministic, real data) +
  share snapshot; Opportunities task-list (Done/Dismiss/Snooze, localStorage-persisted, Handled
  section); "Apply" deep-links on Optimize/Recommendations → prefilled editor; Promotions
  `?cocktail=` prefill + live badge/discount preview; Experience phone-frame live guest preview.
- **Sprint D — Bespoke visualizations:** Tables floor-plan (size = revenue, heat = conversion,
  crown on top table); Heatmap rendered as a heat overlay on a cocktail-page mockup; Journeys
  aggregate funnel stepper with drop-off %; interactive Menu-Engineering matrix (hover stat
  popover + click-to-scroll-and-highlight).

All real-data-only (projections labeled estimates), bilingual EN/HE, no horizontal scroll.

### Changed — Luxury redesign of the entire admin surface ("AI restaurant operating system")

Reworked **every admin screen** from a generic BI/Jira-style dashboard into one premium,
image-led "AI restaurant advisor" product, per owner feedback ("מקצועי כן, WOW לא"). New
shared primitive library `src/components/ui/dataviz.tsx` — `GlassImage` (whole, never-cropped
transparent-glass cocktail render with accent glow; the fix for the clipped-glass bug was a
`relative` container + `absolute inset-0 object-contain` at a **definite height**), `KpiCard`,
`Sparkline`, `deltaPct`, `Pill`, `ConfidenceBadge`, `SectionLabel` — adopted across all screens
so the suite feels like a single luxury product.

Redesigned screen-by-screen (each: real data only — projections labeled estimates, no fabricated
numbers; cocktail imagery via `findCocktailBySlug`/`getAccent`; **no horizontal scroll** anywhere;
bilingual EN/HE; TS-strict, no `any`):
- **Executive** (template), **Home** (icon launcher)
- **Opportunities, Closed Loop, Analytics, Optimize, Signals, Sales** (wave 1)
- **Menu Engineering** (premium 2×2 matrix w/ positioned glasses), **Tables, Journeys, Heatmap,
  Recommendations, Experiments** (honest "collecting data", no fake winners), **CRM/Audience** (wave 2)
- **Promotions, Experience** (forms preserved byte-for-byte), **Events** inspector, **Menu Analysis**
  + **Guests** luxury tab bars (wave 3)
- **Composer, QR, Print kit, Import** (wave 4 — print fidelity + all CRUD/upload/scrape logic intact)

Nav decluttered into an **icon dashboard launcher** (`AdminLauncher` + `Sections` modal in
`AdminShell`); the person icon in the menu now opens `/admin/home` (was the editor). Conversion %
shown as a whole number.

**Verification:** `tsc --noEmit` + `next build` clean across all four waves; all **22 admin routes
runtime-checked in-browser** (zero render errors, real data, graceful empty states); deployed to
production after each wave.

### Fixed — Admin CMS persistence (pre-demo QA)

Pre-demo audit found the composer could not actually save: with Supabase configured, draft
writes/reads went through the **anon key** and were blocked by RLS (no diner-side login) —
items appeared optimistically then vanished on reload. Switched the draft store to
**localStorage by default** (the live menu is static; Supabase drafts need member auth).
Verified end-to-end in a real browser: create cocktail + upload image → persists (image as a
data URL) → appears in the menu → survives reload. Supabase drafts remain available behind
`NEXT_PUBLIC_USE_SUPABASE_DRAFTS=true` once auth exists. Caveat: localStorage drafts are
per-device.

Also verified (multi-user analytics simulation, cleaned up after): unique-session counting
(a drink opened twice in one session counts once), revenue/profit from price snapshots, table
QR attribution + viral split. All 33 pages and 19 APIs return healthy.



### Added — Home Dashboard + nav consolidation (Owner Experience)

Acting on the Owner Experience Audit — fewer destinations, better decisions.
- **Home Dashboard** (`/admin/home`, now the first/primary nav item) — "what should I do
  today?" in one screen. 7 widgets, **pure composition of existing APIs** (no new compute):
  Top Opportunities · **Impact Tracker** (Closed Loop wins) · Business Health · Traffic Trends
  (sparkline) · Promotion Status · Menu Performance · Recent Changes. Each links to its deep screen.
- **Nav consolidation:** the flat ~24-item bar → **8 primary items** + a grouped **"More ▾"**
  (Understand / Setup / Advanced). **Advanced is hidden by default** (owner never sees it unless
  they open More). **Audience/CRM removed** from nav entirely (page kept, unlinked) until there's
  a stable `visitor_id` + real segmentation.
- Positioning reframed as **Menu Optimization** (owners buy revenue + decisions, not "intelligence").

**Workspace merges (done):** **Menu Analysis** (`/admin/menu-analysis`) = Optimize + Menu
Engineering + Heatmap as tabs ("why does this drink behave this way?"); **Guests**
(`/admin/guests`) = Tables + Journeys as tabs ("who were the guests?"). Each screen's body was
extracted into a named `*Panel` export; the standalone routes remain as thin `AdminShell`
wrappers (deep links keep working). Nav: Optimize folded out of primary; Understand group is now
**Menu Analysis · Guests · Pairings**. The Owner Experience Audit plan is complete.

### Added — Closed Loop Optimization v1 (Recommendation → Action → Measured Result)

Turns the product from analytics into **optimization**: it now proves whether a change worked.
- **Measurement engine** (`src/lib/closedloop`, 7 tests) — compares per-day metric rates
  before vs after a change (fair to partial windows), integrity-gated: `too_early` /
  `insufficient_data` when the sample/window is weak — **never a fabricated number**. Zero-baseline
  handled honestly. Every result carries **confidence + observation window** (so owners don't
  overreact to small samples).
- **Generic `changes` audit table** (migration `0010`) — `change_type · entity_type · entity_id ·
  before · after · source · created_at`. Reusable timeline of everything that changed, not a
  Closed-Loop-only table.
- **Automatic change capture** is the default: promotion created/edited/activated/deleted and
  experience updates auto-log a timestamped change. `logChange` is best-effort — **a failed audit
  write never breaks the action** (verified: promotions still create with `0010` absent).
- **Manual log only for external actions** (printed menu, Instagram campaign, photo shoot).
- Surfaces: **`/admin/closed-loop`** (measured results + change timeline + manual-log form).
  API: `/api/closed-loop`, `/api/changes`. 56 tests total.
- v1 is deliberately simple — Before → Action → After + Confidence. No multi-factor attribution.

**Pending:** run `supabase/migrations/0010_changes.sql` to activate. Next per the Owner Experience
Audit: Home Dashboard (with the Impact Tracker widget) → nav consolidation → Menu Analysis / Guests workspaces.

### Added — Opportunity Board (actions over dashboards)

**Opportunity Board** (`/admin/opportunities`) — the "what should I do today?" morning surface.
A pure, tested engine (`src/lib/opportunities`, 8 tests) turns assembled signals into typed,
prioritised opportunities, each with **type · confidence · evidence · suggested action** and the
integrity gate (real evidence counts, direction-only action, **no fabricated revenue**).
- Opportunity types: `fix_offer` (high engagement + low intent), `promote_position` (low
  visibility + high engagement — **uses menu position**, strengthening Blind Spots),
  `promote_marketing` (high sharing + low sales — **Share Intelligence**), `promotion_candidate`
  & `reengage_returning` (**Returning-Visitor Intelligence** via `visitor_id`).
- **Menu Layout Intelligence** on the same board: scroll-depth drop-off (reached item 3+ / half /
  end), category reach, and rarely-reached items.
- New server query `getMenuSignals()` assembles per-item signals from raw events (distinct
  sessions/visitors) + menu position + `visitor_id` (returning / repeat-no-commit) + the `sales`
  table. API: `/api/analytics/opportunities`.
- **Data-integrity fix:** clamped all engagement rates to ≤100% — impressions undercount
  (direct QR/links, "also viewed", card-level favorite/share), which had produced a nonsensical
  "143% open rate". 49 tests total.

### Added

**Pinky + Garden Spritz cocktail videos** (`diner-pinky`, `garden-spritz`)
- One luxury clip per cocktail (`/cocktail/video/diner-pinky.mp4` 3.6 MB, `/cocktail/video/garden-spritz.mp4` 3.65 MB), each wired as **both** the menu-card hover video and the in-drink ▶ Video feature modal, mirroring the Aperol Spritz setup.
- No code paths changed — `MenuCard`, `CocktailScene`, and `MobileCocktailScene` already resolve video by slug via `getHoverVideo`/`getFeatureVideo`; only `COCKTAIL_VIDEOS` data entries were added.
- Verified on prod: videos `200 video/mp4`, home menu references both clips, pages `200`.

### Changed

**OrderBar → "My Picks" (honest intent surface, not ordering)**
- Per the Menu Intelligence direction (`docs/MENU_INTELLIGENCE_PLAN.md`): the platform is intelligence, not a POS/ordering system. The in-app bar no longer fakes fulfilment.
- Removed the **"Call waiter"** action and the **"Sent ✓"** fake-order confirmation. Copy is now intent/picks language: *Add to my picks → Show waiter · N → In your picks ✓*.
- Still captures purchase **intent** (`add_to_order_clicked` / `order_started` / `order_completed`) with a price/cost snapshot — now labelled **intent value** ("potential revenue"), never "actual sales" (real sales arrive later via read-only POS ingestion).

### Removed

**All dead 360° code** (360 was replaced by videos earlier)
- Deleted components `Cocktail360.tsx`, `Cocktail3D.tsx`, `Spin360.tsx` and the `/spin/[slug]` route.
- Removed `COCKTAILS_WITH_3D`, `has3DModel()`, `model3dUrl()` from `src/data/cocktail.ts`.
- Verified: zero live references before deletion; `/spin/…` now `404`, **AR (`/ar/…`) kept and `200`**, `tsc` + `build` green, prod pages `200`.

### Added — Menu Intelligence foundations

Building the platform from `docs/MENU_INTELLIGENCE_PLAN.md` (intelligence + optimization, not ordering). Added **vitest** — first tests in the repo (**35 passing**).

**Scheduling core** (`src/lib/scheduling`) — the ONE shared time-window primitive (recurring / date-range / seasonal), DST-correct via `Intl`, evaluated in the **restaurant timezone** with an injectable `now`. Reused by everything schedulable. 10 tests.

**Menu Experience layer** (`src/lib/experience`) — per-item content-module toggles + badges (Signature, Guest Favorite, Trending, Happy Hour, Discount, Seasonal, Limited Time, New, Custom), each enable/disable/**schedulable**; manual vs **data-driven (auto)** badges. 8 tests.

**Promotions Engine** (`src/lib/promotions`) — %/fixed discounts, item/category/all scope, scheduled; picks the best active price; **each active promo drives its own badge** (single source of truth). 8 tests.

**Menu Optimization layer** (`src/lib/optimization`) — turns menu-engineering data into owner **actions** (fix offer / promote position / raise price / review / keep), each with a rationale + confidence. **Integrity gate:** a numeric impact estimate appears only when derivable AND data supports it — low-data items say "collect more data", never a fabricated %. 9 tests. Surfaced at **`/admin/optimize`** ("Action, not metrics").

**Diner-facing:** badges + auto-applied promo pricing (strikethrough original → discounted) on the menu cards, resolved in the restaurant timezone. Starter config in `src/data/experience.ts` (Aperol = Signature, Pinky = New for June, Garden Spritz = Summer −15%, Friday Happy Hour −20%).

**Owner config — now DB-driven (no developer needed):**
- **Promotions Engine** (live & verified end-to-end against the DB): `/admin/promotions` CRUD editor + `/api/promotions` (public read, admin write via service-role) + `promotions` table (migration `0007`, applied). Discounts auto-apply on the menu and light their own badge when live; the diner menu loads them via `useMenuConfig` (falls back to in-code defaults). Verified: create → list → delete leaves no residue.
- **Menu Experience Builder**: `/admin/experience` (toggle badges + content modules per cocktail) + `/api/experience` + `menu_experience` table (migration **`0008` — pending**, since the live menu is static so `cocktails` is empty). Until `0008` runs, the API 500s gracefully and the menu uses in-code defaults.
- Discriminated-union `Schedule` reused everywhere; restaurant-id resolved + cached server-side. `Database` types extended for both tables.

**Diner discovery + sales (third pass — `0008` applied & verified):**
- **Experience Builder** verified E2E (PUT/GET round-trip); **Promotions** verified E2E (create→list→delete clean).
- **"Guests also viewed"** (`AlsoViewed`) — data-driven cross-sell from real co-view behaviour (`/api/analytics/recommendations`) on both desktop & mobile cocktail pages; renders nothing without real data.
- **Mood filter** ("What suits me now?") — `sweet / sour / refreshing / strong / herbal` derived from the flavor profile (`src/lib/mood.ts`, 6 tests), wired into the menu grid filter.
- **Read-only sales ingestion** — `/admin/sales` (CSV paste import) + `/api/sales` + `sales` table (migration **`0009` — pending**, members-only RLS). The **Optimize** screen shows actual units/revenue per item when sales exist (degrades gracefully without `0009`). This is the conversion denominator.
- Test suite: **41 passing**.

**Discovery polish + heatmap (fourth pass — `0009` applied & verified):**
- **Sales ingestion** verified E2E (POST→GET→cleanup); Optimize shows actual sales when present.
- **Per-cocktail stories** (`CocktailStory`) on the cocktail page (desktop + mobile).
- **Time-of-day hint** ("Perfect for sunset" / "Nightcap hour" …) on the menu, restaurant timezone.
- **Top Picks** (Most Viewed + Hidden Gem) — data-driven, hidden without data.
- **Attention Heatmap** — `SectionAttention` instrument (IntersectionObserver dwell → `section_attention` event) wraps the ingredients / flavor / story sections; aggregated at **`/admin/heatmap`** ("which part drew the eye").

**Menu Intelligence plan: COMPLETE.** All layers live — Guest Experience, Behavior Intelligence, Menu Optimization. Migrations `0006`–`0009` applied. 41 unit tests. The platform now answers: what guests wanted, what drew them, where they dropped, and what the owner should do next.

---

## [2.4.0] — 2026-06-01

Real Supabase connected — schema live, security model validated against the running database.

### Done

**Migrations applied to the live project** (`fihaaolredpqbdrdpuca`, eu-central)
- `0001_initial_schema`, `0002_storage_bucket`, `0003_cocktail_extras` all ran clean
- Verified: 6 tables present, `cocktails` has `price_ils`/`pairings`/`available_hours`, Diner seed restaurant exists

**RLS security model validated against the live DB (as the `anon` role)**
- anon reads published cocktails → ✅ visible
- anon reads drafts → ✅ hidden (0 rows)
- anon writes a cocktail → ✅ denied with code `42501` (the non-retryable code `isTransient()` already classifies correctly — no retry-storm)
- Confirms: public menu is readable without auth; **draft create/read requires auth** (next milestone)

### Fixed

**Restaurant resolved by slug, not a hardcoded UUID**
- The seed restaurant's id is per-database (`gen_random_uuid()`), so the hardcoded `00000000-…0001` was wrong
- `SupabaseAdapter` now resolves the UUID from the stable slug `diner` and caches it; `store/index.ts` log context uses the slug marker

**Runtime connection live + validated**
- anon + service_role keys placed in `.env.local`; `isSupabaseConfigured()` → true → factory switched to `SupabaseAdapter`
- Verified live in-browser: `store initialized {provider: supabase}`, `draft.load.succeeded` in **337ms** (real eu-central round-trip vs ~3ms localStorage), correlation id intact, slug→UUID resolution worked, home renders with 0 errors
- anon can read `restaurants` (slug resolution) — confirmed against live DB

### Pending (needs user)

- **Rotate the secrets shared in plaintext**: database password, `service_role` JWT, and `sb_secret_…` (Settings → Database / API Keys). The anon/publishable key is public-safe.
- Draft create/read still requires auth (RLS) — next milestone: auth around restaurant tenancy.

---

## [2.3.0] — 2026-06-01

Integration-readiness — correlation IDs, a stable event taxonomy, dirty-state semantics, and a fault-injection harness, so connecting real Supabase can be validated with deliberate failure testing instead of hope.

### Added

**Event taxonomy + correlation IDs (`src/lib/observability/events.ts`)**
- Stable dotted event names (`draft.save.started/retry/succeeded/failed`, `draft.load.*`, `draft.delete.*`, `draft.publish.*`, `draft.find.*`) instead of free-text logs
- `OpContext` (requestId, op, restaurantId, slug, provider) threaded through every operation chain via `newRequestId()` (crypto.randomUUID with fallback)
- **Verified:** `draft.load.started` and `draft.load.succeeded` share one `requestId` across the async chain

**Fault-injection harness (`src/lib/observability/faults.ts`)**
- Dev/preview only — never injects in production
- Console control surface `__faults.set('network'|'rls'|'slow')` / `.once()` / `.clear()`
- `network` → transient error (retry fires); `rls` → code 42501 (no retry); `slow` → delay (pending-UI test)
- **Verified:** injecting `network` produced `WARN[faults] injecting fault` → `ERROR[store] draft.load.failed`, UI degraded gracefully (no hang/crash)

**Dirty-state semantics (`useDrafts`)**
- Per-draft `SyncStatus`: `saved | saving | dirty | sync_failed | retrying`
- Optimistic updates: a draft appears instantly, marked `saving`; on success `saved`; on failure the optimistic copy is kept and marked `sync_failed` (never silently lost)
- Exposes `syncStatus`, `syncStatusFor(slug)`, `markDirty(slug)`

### Changed

- `CocktailStore` methods accept an optional `OpContext`; the `instrument()` boundary generates it, emits taxonomy events, and runs fault injection
- `withRetry` now carries correlation `context` and emits the `draft.save.retry` event
- Adapters now **throw on unrecoverable write failure** (instead of returning a transient draft) so dirty-state can detect it; `useDrafts` keeps the optimistic copy and marks `sync_failed`
- `LocalStorageAdapter` throws on quota/private-mode write failure

---

## [2.2.0] — 2026-06-01

Observability foundation — before adding auth, make the now-async persistence layer observable so failures surface as events instead of silent data drift.

### Added

**Structured logger (`src/lib/logger.ts`)**
- Leveled (debug/info/warn/error), gated by `NEXT_PUBLIC_LOG_LEVEL` (dev: debug, prod: info)
- Contextual via `logger.child({ scope })`; production output is single-line JSON ready for an aggregator
- The single sanctioned `console.*` sink in the codebase

**Adapter instrumentation (`store/index.ts`)**
- A decorator wraps every `CocktailStore` so all calls log duration, payload size, success/failure, and provider — both adapters get it for free
- Confirmed live: `store initialized {provider}`, `getDrafts ok {ms}`, `saveDraft ok {slug, ms, bytes}`

**Retry with backoff (`src/lib/retry.ts`)**
- `withRetry` retries transient (network/5xx) Supabase writes with exponential backoff; logical errors (RLS, constraints) surface immediately via `isTransient`
- Applied to the critical cocktail upsert in `SupabaseAdapter`

**Error boundary (`src/components/ErrorBoundary.tsx`)**
- Catches subtree crashes, logs them with component stack, shows a graceful fallback
- `CocktailScene`'s 3D canvas is wrapped with a **static-hero-image fallback** — a WebGL crash degrades gracefully instead of blanking the page

**Architecture docs (`docs/architecture/`)**
- `storage-strategy.md`, `data-flow.md`, `rendering-architecture.md` — capture the adapter boundary, draft lifecycle, and rendering/perf debt before complexity compounds

### Changed

- Replaced all ad-hoc `console.error` in the Supabase/localStorage adapters with structured `logger` calls
- `LocalStorageAdapter` quota/private-mode write failures are now logged instead of silently swallowed

---

## [2.1.0] — 2026-06-01

Persistence foundation — a storage adapter layer that runs on localStorage today and switches to Supabase the moment credentials exist, with zero UI changes.

### Added

**Storage adapter layer (`src/lib/store/`)**
- `interface.ts` — the `CocktailStore` contract: `getDrafts` / `saveDraft` / `deleteDraft` / `publishDraft` / `findDraft`
- `local.ts` — `LocalStorageAdapter` (default; the active backend until Supabase is configured)
- `supabase.ts` — `SupabaseAdapter` writing across the normalized schema (`cocktails` 1──< `cocktail_layers` / `cocktail_labels`), with nested reads and delete-then-insert child replacement
- `index.ts` — `getStore()` factory: picks Supabase when `NEXT_PUBLIC_SUPABASE_URL` is set, else localStorage
- `useDrafts` now delegates to the adapter — its public API is unchanged, so no component had to change beyond awaiting the now-async `upsert`/`remove`

**Migration `0003_cocktail_extras.sql`**
- Adds `price_ils`, `pairings`, and `available_hours` columns so the `cocktails` table fully represents `CocktailConfig`
- Regenerated `supabase/types.ts` to match

### Fixed

**Supabase typed-client `never` errors**
- The hand-written `Database` type was missing the `Relationships: []` key on every table and the `Views`/`Functions`/`Enums`/`CompositeTypes` schema keys
- Without them, supabase-js's `GenericTable`/`GenericSchema` constraints failed and all insert/update/upsert argument types collapsed to `never`
- Added the required keys — typed inserts now resolve correctly

**Legacy draft migration**
- Drafts saved before the refactor used `draftCreatedAt`/`draftUpdatedAt`; the new adapter expects `createdAt`/`updatedAt`
- `LocalStorageAdapter.load()` now upgrades legacy records on read so existing drafts are not silently lost

### To activate Supabase

1. Create a Supabase project
2. Run `supabase/migrations/*.sql` in order (SQL editor or CLI)
3. Paste `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` into `.env.local`
4. Restart — the factory auto-switches; the UI is identical

---

## [2.0.0] — 2026-06-01

Design-system overhaul — site-wide consistency, fixed CSS cascade bug, and a full-width 3-zone cocktail detail layout.

### Fixed

**Critical CSS cascade bug — all spacing utilities were dead**
- An unlayered `* { margin: 0; padding: 0 }` reset in `globals.css` silently overrode every Tailwind utility inside `@layer utilities`
- Result: all `px-*`, `py-*`, `p-*`, `m-*`, `gap-*`, `mx-auto` computed to 0 site-wide — nothing was centered, everything hugged the edge
- Fix: removed the manual reset (Tailwind v4 Preflight already resets inside `@layer base` where utilities correctly override it)

**Menu cards — glass overlapping description**
- The hero image and text block were absolutely positioned with no floor; 2-line titles caused 92–117px overlap
- Replaced with a flex-column layout: image fills remaining space on top, text block sits below — overlap is structurally impossible regardless of title length
- Verified: all 9 cards now have a consistent +11px gap between image and text

**Menu cards — uneven alignment across cards**
- Titles, prices, and "Explore" links landed on different rows per card
- Fixed: text block now a fixed-height flex column (`h-[244px]`) with title reserving 2 lines, tagline 2 lines, and price + explore row pinned to the same baseline via `mt-auto`
- Verified: 6 measured rows all land at identical pixel positions across all 9 cards

**Print Kit — "4 per page" rendered as 2**
- The density=4 branch produced `grid-cols-2` (identical to density=2)
- Fixed: density=4 now produces `grid-cols-2 lg:grid-cols-4` on screen, `print:grid-cols-2` (2×2 = 4 per A4 sheet)
- Also fixed compact card overflow (content clipped 26px) by switching to content-height sizing with `minHeight: 20rem`

### Added

**`AdminShell` — unified admin layout component**
- Consistent sticky top nav, clamped h1, diamond divider, centered `max-w-6xl` container, and print CSS
- Applied to all admin-section pages: `/admin`, `/admin/new`, `/admin/[slug]/edit`, `/admin/import`, `/admin/print`, `/admin/qr`, `/admin/analytics`, `/changelog`

**Cocktail detail — 3-zone full-width layout (xl+)**
- Left column (260px): flavor radar, bartender note, pairings
- Center column (flex-1): exploded 3D breakdown + ingredient labels
- Right column (400px): full-size hero photo with `mix-blend-screen` — black background dissolves into the dark page, cocktail appears to float
- Hero photo: 344×459px (was 216px wide) — significantly larger
- Label offset reduced to `5rem` from center to clear the wider photo column
- Below xl: falls back to full-screen 3D canvas with bottom-left flavor panel (unchanged mobile experience)

**Prices for all cocktails**
- 6 Diner cocktails now have placeholder prices (52–62 ₪) — editable via `/admin`
- All 9 menu cards show consistent price rows on the same baseline

**Ingredient copy — Citrus Lime Sour (Task #100 completed)**
- Replaced 6 generic descriptions with punchy editorial copy matching the style of the other cocktails
- Example: "The base spirit brings depth and a clean botanical character" → "London Dry — juniper-led, clean botanical backbone."
- Hebrew translations updated to match

### Verified

- Full site audit: all 14 routes return 200 (or correct 405 for POST-only APIs)
- Mobile (375px): home grid, cocktail detail, AR — all render correctly
- TypeScript: `tsc --noEmit` clean throughout

---

## [Unreleased]

### Planned (Sprint 4 Phase B — blocked on user setup)
- Wire `useDrafts` to Supabase instead of localStorage
- Auth pages `/login` + `/signup` with email + Google
- Restaurant onboarding (signup → create restaurant → invite team)
- Multi-tenant routes `/r/[restaurantSlug]/...`
- Real photo→3D pipeline (SAM segmentation)
- Live analytics (replace mock with telemetry from `events` table)

---

## [1.9.0] — 2026-05-28

7-layer architecture with per-cocktail prompt overrides. The Aperol orange-peel problem is finally solved.

### Added

**`makeCustomLayers(slug, overrides)` helper**
- Each cocktail can override the generation prompt per layer slot, or hide a slot entirely
- Image paths auto-derived from slug: `/cocktail/drafts/{slug}-{layer-id}.png`
- Default behavior preserved for cocktails that don't override anything

**`splash_soda` — 7th layer slot**
- Inserted between `splash_clear` and `splash_pink` (at y=−0.75)
- New `Soda Water` label added to `APEROL_SPRITZ_LABELS`
- Numbered 06 (so Aperol Spritz glass becomes 07)

**Aperol-specific per-layer prompts**
- 7 custom prompts engineered to escape Pollinations' green-lime bias
- `lime_peel` → "Long curling ribbon of fresh orange citrus rind, sunset orange amber"
- `lime_wedges` → "Three round wheels of fresh blood orange citrus fruit"
- `splash_pink` → "Aperol liquor liquid splash crown, vivid amber-orange"
- `splash_clear` → "Prosecco golden champagne splash crown"
- `splash_soda` → "Pure transparent soda water splash crown"
- `glass` → "Tall stemless balloon wine glass filled with Aperol Spritz"
- Result: orange peel layer **finally rendered orange** ✓

**CLI rewrite** (`scripts/generate-cocktail-breakdown.ts`)
- Now iterates `cocktail.layers` instead of `SHARED_LAYERS` so per-cocktail prompts are honored
- Drops the legacy `customizePrompt` (was double-appending context)
- Reads `layer.generationPrompt` directly

### Changed

**SHARED_LAYERS — compressed for 7 slots**
- Scales reduced ~30% (glass 0.95 → 0.7, splashes 0.85 → 0.55, ice/wedges 0.45 → 0.35, peel 0.35 → 0.28)
- Y range tightened to −1.4 to 1.65 (3.05 units, 73% of viewport)
- All 7 layers fit cleanly with ~0.3 unit margin top + bottom
- No clipping on any standard 16:9 or portrait viewport

### Tech
- 30 routes, build green
- 4 new generated files in `public/cocktail/drafts/` for Aperol Spritz (orange peel, orange slice, soda splash + regen of existing 3)
- All other cocktails inherit SHARED_LAYERS unchanged — Aperol is the first cocktail using `makeCustomLayers`. Path forward: gradually add per-cocktail prompt sets for Negroni, Pinky, Margarita, etc.

---

## [1.8.0] — 2026-05-28

Editorial label restyle + breathing-room layout — pulls the breakdown view closer to the reference Aperol Spritz card the user shared.

### Changed

**Labels**
- Removed `01/02…` number circles
- Title is now caps + tight tracking in **orange-400** (matches reference accent), not gold-amber
- Description is italic Garamond (or Heebo for HE), smaller and lighter
- Connector is a tiny orange dot + a 36px thin amber line pointing toward the layer
- Active state: title brightens, dot grows + glows, origin reveals below the description

**Layer spacing** (`SHARED_LAYERS`)
- Y positions spread wider: glass −1.35 · splash_clear −0.6 · splash_pink 0.3 · ice 1.0 · lime_wedges 1.5 · lime_peel 1.9 (was −1.25 to 1.4)
- Scales reduced ~15% to fit the wider spread without clipping (e.g. glass 1.25 → 0.95)
- Result: ample whitespace between layers, closer to the editorial reference

### Tech
- 30 routes, build green
- All cocktails inherit the new spacing automatically (Aperol still drops 2 layers via filter)

---

## [1.7.2] — 2026-05-28

### Fixed
- **Aperol Spritz green-lime mismatch** — `lime_peel` and `lime_wedges` layers came back GREEN even when the cocktail context said "Aperol, orange". Pollinations / Flux are heavily biased toward green lime imagery for any "spiraling peel" or "citrus wedge" prompt, and several retries (model swap to `flux-realism`, explicit "blood orange / NOT lime / NOT green" phrasing, anchor word replacement) all returned the same green output.
- Workaround: **drop those two layers entirely** for Aperol Spritz. The remaining 4 (ice, Aperol splash, Prosecco splash, glass) carry the story cleanly. Labels for the dropped layers are skipped automatically because `IngredientLabels` already returns `null` when its `layerId` can't be resolved.
- Path forward (deferred): per-cocktail layer templates so each cocktail can choose which slots to use and what to put in them — instead of every cocktail trying to fill the citrus-themed SHARED_LAYERS.

---

## [1.7.1] — 2026-05-28

### Fixed
- **Per-cocktail labels** — all 9 cocktails previously reused `CITRUS_LIME_SOUR.labels`, so the Aperol Spritz / Negroni / Margarita pages showed "Lime Peel · Persian lime, hand-zested" next to orange/citrus/whiskey imagery. Each cocktail now has its own typed labels matching its actual ingredients:
  - **Aperol Spritz** — Orange Peel · Orange Slice · Ice Cubes · Aperol · Prosecco · Aperol Spritz
  - **Negroni** — Orange Peel · Orange Wheel · Ice Sphere · Sweet Vermouth · Campari · Gin
  - **Pinky** — Lime Peel · Fresh Raspberries · Crushed Ice · Raspberry Liqueur · Tonic Water · Pink Gin
  - **Margarita** — Salt Rim · Lime Wedge · Ice · Fresh Lime Juice · Triple Sec · Tequila Blanco
  - **Green Garden** + **Garden Spritz** — Fresh Basil · Cucumber Ribbon · Crushed Ice · Elderflower · Lime Juice · Sparkling Water
  - **Smoked Old Fashioned** — Orange Peel · Brandied Cherry · Clear Ice Sphere · Bitters · Demerara Syrup · Smoked Bourbon
  - **Whiskey Sour** — Maraschino Cherry · Lemon Peel · Ice · Egg White · Fresh Lemon Juice · Bourbon
- Each label includes origin (e.g., "Tanqueray London Dry", "Carpano Antica Formula", "Maker's Mark") so the editorial subtitle stays correct per cocktail
- `GREEN_GARDEN_LABELS` + `SMOKED_OLD_FASHIONED_LABELS` hoisted above their first usage to satisfy TS `used before its declaration` check

---

## [1.7.0] — 2026-05-28

Static poster export — the missing piece that turns a 3D experience into something a restaurant can post to Instagram or print at A3.

### Added

**`/api/poster/[slug]` — editorial static export**
- Returns a **1200×1500 PNG** composed via `next/og` ImageResponse
- Loads each cocktail layer + label from disk, embeds as base64 data URLs
- Layout mirrors the Components Breakdown reference: category caps · gradient italic title · diamond divider · "Components Breakdown" subtitle · 6 layers stacked vertically with right-side numbered labels · footer with brand + tagline
- Works for any cocktail in `MENU` with unique layers (e.g., `diner-aperol-spritz` after the breakdown CLI ran)
- Pure server render — no client-side compositing needed

**`PosterButton` component**
- Mounted in `CocktailScene` next to Share / Ambient / AR
- Click → fetches the API → downloads as `{slug}-poster.png`
- Shows "Building…" while generating
- Bilingual label (Poster / פוסטר)

**CLI mirror of breakdown generation** (`scripts/generate-cocktail-breakdown.ts`)
- `npm run generate:breakdown <slug>` reproduces the `/api/generate-breakdown` flow without needing a running dev server
- Used to produce the unique Aperol Spritz layers and wire them into `DINER_APEROL_SPRITZ`

### Changed
- `DINER_APEROL_SPRITZ.layers` now uses the freshly generated `public/cocktail/drafts/diner-aperol-spritz-*.png` set (orange-amber color profile matching the cocktail's actual identity)
- Build: 30 routes (added `/api/poster/[slug]`)

### Tech
- ImageResponse JSX requires `.tsx` extension — route is at `src/app/api/poster/[slug]/route.tsx`
- All image assets embedded as base64 — works in any deployment without external URLs

---

## [1.6.0] — 2026-05-28

Print kit — editorial table tents the restaurant can print and place on tables.

### Added

**`/admin/print` page**
- Editorial single-card layouts (one per cocktail) that print as table tents
- Each card contains: diamond flourish · category · big Playfair italic name · tagline · hero image · bartender pull-quote · QR + price
- Print stylesheet (`@page A4 12mm margins`, `break-inside: avoid` per card, removes all dark chrome)
- **Density toggle** — 1 / 2 / 4 cards per A4 page
- **QR target toggle** — Breakdown view vs AR view
- **Currency toggle** — same `₪ / $ / €` switch as elsewhere, shown on the printed card
- **Include bartender note** checkbox — hides quote for tighter layouts
- "Print sheet" button triggers native print dialog with stylesheet applied
- Linked from `/admin` header (`Print Kit →` next to QR Codes)

### Tech
- Reuses `qrcode` library (already installed)
- Reuses existing `formatPrice` helper for currency conversion
- All work client-side, no new APIs

---

## [1.5.0] — 2026-05-28

Quality-of-life features for diners and operators. Price display, ambient sound, view history, and time-of-day kiosk filtering.

### Added

**Multi-currency display**
- New `Currency` type (`ILS | USD | EUR`) + `formatPrice(priceILS, currency)` helper
- Static FX rates in `FX_FROM_ILS` (replace with live API when backend ready)
- `priceILS?: number` field on `CocktailConfig` (3 house signatures get prices: ₪58 / ₪68 / ₪42)
- `CurrencyToggle` pill component (mirror of LanguageToggle)
- `useCurrency` hook with localStorage persistence
- Toggle visible top-right on home page; price shown on every menu card

**Ambient sound** (`useAmbientSound`)
- Web Audio API generative drone — 3 detuned sine oscillators at A2 (110 Hz) through a low-pass filter
- Off by default, user-gesture activated, gain ramps over 1.5s to 0.08 peak
- localStorage remembers preference between visits
- `AmbientToggle` button (small speaker icon with X when muted, waves when on) — mounted on `CocktailScene` next to Share + AR

**Recently viewed**
- `useViewHistory` hook with localStorage (last 8 cocktails, deduped, sorted by time)
- `CocktailScene` records a view on mount
- Home page renders a "Recently viewed" pill strip above the filters when there's any history and the user hasn't searched/filtered
- Each pill links straight back to that cocktail (handles both hardcoded + drafts)

**Kiosk schedule** (time-of-day filtering)
- New `availableHours?: [number, number]` on cocktails (wraps midnight)
- `isAvailableNow(cocktail, currentHour)` filter in `/kiosk`
- Citrus Lime Sour: noon-midnight (12-24) · Smoked Old Fashioned: evening only (17-24) · Garden Spritz: all day (8-24)
- Kiosk footer shows current time + count of hidden items
- Press **S** in kiosk to toggle schedule on/off
- Auto-falls-back to full MENU if filter would leave 0 items

### Changed
- `MenuCard` now accepts optional `currency` prop and renders price below tagline when set
- `/kiosk` keybindings expanded: `S` toggles schedule, others unchanged

### Tech
- 28 routes (no new routes; data additions only)
- All features client-side, no external deps

---

## [1.4.0] — 2026-05-27

The full QR + AR loop. Scan a code at the table → cocktail appears floating in your camera view.

### Added

**AR view** (`/ar/[slug]`)
- Camera feed (rear-facing) as full-screen background via `getUserMedia`
- Cocktail hero image floats over the camera feed
- **One finger drag** to reposition · **two-finger pinch** to scale (0.3-2.5×)
- **📸 Capture** button — composites camera frame + hero into a downloadable PNG
- **Reset** button restores default position
- Top-left badge "AR · Live · {cocktail name}"
- Graceful permission states: `starting` / `ready` / `denied` (retry button) / `unsupported`
- Cleans up camera tracks on unmount

**QR scanner** (`/scan`)
- Camera-driven QR scanner powered by the `qr-scanner` library (works on iOS Safari)
- Recognizes our app URLs: `/cocktails/...`, `/drafts/...`, `/ar/...`
- Other URLs/strings are ignored — keeps scanning
- Auto-routes when a valid match is found
- "Last seen" preview shows what was decoded (helps debugging stickers/screens)
- Same `starting/ready/denied/unsupported` state machine

**Navigation**
- `⌖ Scan QR` link added to home page footer
- `View in AR` button added to `CocktailScene` (mobile-only) next to Share
- QR generator `/admin/qr` now has a **Breakdown ↔ AR view** toggle — every printed QR can deep-link straight into the AR experience instead of the breakdown page

### Tech
- `qr-scanner` (^1.4.2) — vetted iOS-compatible library
- Pointer Events API (works for both mouse and touch) used for AR gestures — no separate handlers
- Build: 28 routes (added `/ar/[slug]` + `/scan`)

---

## [1.3.0] — 2026-05-27

Diner-facing experience polish — pairings, mobile-first labels, PWA, gyroscope.

### Added

**Pairings**
- New optional `pairings?: Localized[]` on `CocktailConfig`
- 3 hardcoded cocktails seeded with pairing suggestions (oysters, ribeye, burrata, etc.)
- `Pairings` component renders "Pairs with · X · Y · Z" under the bartender note in elegant italic serif

**Mobile labels — bottom sheet** (`MobileLabelSheet`)
- Replaces the hidden-on-mobile right-side labels panel
- When user taps a layer in the 3D scene, a glass-blur sheet slides up from the bottom showing name + origin + description
- × button to dismiss; sheet auto-hides when `activeLayerId` clears
- Desktop labels unchanged (still `hidden md:block`)

**PWA support**
- `src/app/manifest.ts` — Next 16 file-based manifest at `/manifest.webmanifest`
- `applicationName`, `appleWebApp.capable: true`, `statusBarStyle: 'black-translucent'`
- `viewport.viewportFit: 'cover'` for iPhone notch handling
- "Add to Home Screen" produces a black-themed standalone app

**Gyroscope tilt** (`useGyroscope`)
- Subscribes to `DeviceOrientationEvent`, normalizes `beta/gamma` to `-1..1`
- iOS 13+ permission flow: shows "Enable tilt" pill on mobile when permission required
- Non-iOS Android browsers auto-enable
- Tilt is fed into `CocktailLayers` via a ref and **added to pointer offset** in `useFrame` — so layers respond to phone tilt the same way they respond to mouse on desktop
- Multiplied by each layer's existing `parallaxFactor` (back layers move less, front layers more)

### Tech
- 27 routes (added `/manifest.webmanifest`)
- `tiltRef` plumbed from `useGyroscope` → `CocktailScene` → `CocktailLayers` → `useFrame` (no re-renders; mutates ref directly at 60 Hz)
- All four features ship without external services

---

## [1.2.0] — 2026-05-27

Multi-platform scraping. The importer now reaches beyond getmood.io.

### Added
- **Wix Restaurants parser** — uses stable `data-hook="menu-section"` / `menu-item` / `menu-item-name` / `menu-item-price` / `menu-item-description` / `menu-item-image` attributes. Handles both nested (menu-section wrapper) and flat layouts.
- **Tabit parser** — best-effort, reads embedded `window.__APP_DATA__`-style JSON islands. Most Tabit menus load via API so YMMV; falls through to generic.
- **Generic HTML fallback** — extracts h-tag items + nearby `\\d+ ₪ / shkalim / NIS / ש"ח` prices. Works on simple static menus.
- **Smart platform detection** — checks signatures in this order: getmood.io → Tabit → Wix → generic (heuristic on heading + price counts) → unknown.
- **Cross-parser fallback** — if a platform-specific parser returns zero categories, generic is tried before failing.
- **Image extraction** — parsers now return `image` per item when available (Wix item photos, Tabit JSON).

### Changed
- `Platform` union now: `'getmood.io' | 'wix' | 'tabit' | 'generic' | 'unknown'`
- `/admin/import` help text updated to list all supported platforms

### Tech
- Verified getmood.io regression-free (Diner still parses 75 items)
- Build: 25 routes (unchanged count)

---

## [1.1.0] — 2026-05-27

Restaurant-ops features: kiosk display, table-tent QR codes, bulk breakdown generation.

### Added

**Kiosk mode** (`/kiosk`)
- Full-screen, no chrome — drops straight into rotating `CocktailScene`
- Auto-advance every 12s through every cocktail in `MENU`
- Top edge: amber progress bar (resets per item)
- Bottom-right counter `01 / 09`; bottom-left help hints (`ESC` / arrow keys / space)
- Keyboard: `Esc` exits to menu, `←/→` switch, `Space` pauses
- "× close" button top-right; "Kiosk →" link added to admin header

**QR code generator** (`/admin/qr`)
- One QR per cocktail (hardcoded + drafts), pointing to its public URL
- Dark amber theme (`#0a0a0a` on `#fde68a`), high error correction (`H`)
- Per-card "Download PNG" + global "Download all"
- Print-friendly stylesheet (`@media print`) — light background, grid layout, no chrome
- "Print sheet" button triggers browser print
- "QR Codes →" link added to admin header
- Uses `qrcode` (^1.5.4) for client-side generation

**Bulk breakdown generation**
- New `BulkBreakdownButton` component in `src/components/admin/`
- Shown on `/admin` when one or more drafts lack custom layers
- Iterates drafts sequentially; for each calls `/api/generate-breakdown` and reads NDJSON to completion, then `upsert`s with new layers
- Live per-draft status list (`pending → in_progress → done / error`)
- Confirms before running (~75s per draft × N estimate)
- Hides itself when all drafts already have custom layers

### Changed
- Admin header gained 2 new links (QR + Kiosk) — now 5 total: Import / QR / Kiosk / Analytics / Build Log

### Tech
- 25 build routes (3 dynamic APIs, 9 static cocktails, 10 static admin/kiosk/changelog/etc.)
- `qrcode` + `@types/qrcode` installed
- All new features work without Supabase (use `MENU` + `useDrafts` localStorage)

---

## [1.0.0] — 2026-05-27

The platform moat. Restaurant owners can now ingest their entire menu from any supported URL in one click, with AI generating hero images for every item.

### Added

**One-click restaurant import wizard** (`/admin/import`)
- URL input + restaurant name → "Scan menu" → live category chips → per-item checkboxes + category override → "Import N items" with streaming progress
- Per-item status (pending → in_progress → done / error) updates live during generation
- Smart category guessing (heuristics on Hebrew + English keywords — whiskey/bourbon → smoky, citrus → citrus, etc.)
- Auto-redirects to `/admin` after completion so user sees their fresh drafts
- "Import →" link added to admin header (left of Analytics)

**Shared scraper lib** (`src/lib/restaurant-scraper.ts`)
- `scrapeRestaurant(url)` → `ParsedMenu` (categories + items + platform + photo presence)
- Used by CLI script, scrape API, and import UI — single implementation
- Currently supports getmood.io; adding more platforms is one function

**APIs**
- `POST /api/scrape-restaurant` — JSON: `{ url } → ParsedMenu | error`
- `POST /api/import-restaurant` — streaming NDJSON: per-item `start/done/error` + final `complete` with drafts
- Each imported item: Pollinations hero generation → server-side bg removal → save to `public/cocktail/drafts/{slug}-hero.png`
- Generated draft includes name, tagline (from desc), category, default flavor profile, signed bartender note attributing the source restaurant

### Tech
- 22 build routes (3 dynamic APIs, 9 static cocktails, several admin pages)
- CLI script (`npm run import:restaurant <url>`) now also uses the shared lib (no duplication)

---

## [0.9.0] — 2026-05-27

First real-world restaurant ingestion. The platform now contains **9 cocktails** — 3 house signatures + 6 real ones imported from **Diner** (https://www.dinerrest.co.il/).

### Added
- `scripts/import-restaurant.ts` — generic restaurant menu scraper. Currently supports `getmood.io` (the SaaS used by Diner and many other Israeli restaurants). Detects platform, parses categories + items, prints structured JSON. Usable for any URL: `npm run import:restaurant <url>`
- `scripts/fixtures/diner-menu.json` — full parsed Diner menu (75 items, 13 categories) + 6 enriched cocktails with English/Hebrew names, taglines, flavor profiles, categories
- 6 new published cocktails in `MENU`: `diner-aperol-spritz`, `diner-negroni`, `diner-pinky`, `diner-margarita`, `diner-green-garden`, `diner-whiskey-sour`
- Each Diner cocktail has its own AI-generated hero image (Pollinations + bg removal) — 6 new `.png` files in `public/cocktail/`
- Bartender notes signed "— Diner" so they read as the restaurant's voice

### Findings (important context)
- **Diner has zero per-dish photography on the site** — it's a text-only menu (name, price, description). This is the norm for most mid-tier restaurants in Israel.
- Practical consequence: the AI pipeline must work **without input photos**. The current text→image generation already handles this perfectly.
- The "real photo→3D breakdown" feature (GPT-4 Vision based) only becomes valuable for restaurants that DO have professional photography (rare).

### Tech
- All 9 cocktails share `SHARED_LAYERS` as breakdown template (per-cocktail breakdown generation is available on demand via the wizard but not pre-generated)
- Build now prerenders 9 cocktail routes (3 hardcoded + 6 Diner) — 15 total routes

---

## [0.8.0-prep] — 2026-05-27

Sprint 4 Phase A prep. Schema + infrastructure are ready; user needs to create the Supabase project and send keys.

### Added

**Database schema** (`supabase/migrations/`)
- `0001_initial_schema.sql` — full schema: `restaurants`, `restaurant_members`, `cocktails`, `cocktail_layers`, `cocktail_labels`, `events` + indexes
- Row Level Security (RLS) policies on every table — published cocktails are public, drafts are scoped to members, events insertable anonymously
- Idempotent (`if not exists` / `drop policy if exists`) — safe to re-run
- Seed row: `{ slug: 'diner', name: 'Diner' }` as the first restaurant
- `updated_at` trigger on `cocktails`

**Storage bucket** (`supabase/migrations/0002_storage_bucket.sql`)
- `cocktail-assets` public bucket
- Convention: `cocktail-assets/{restaurant_slug}/{cocktail_slug}/{layer_id}.png`
- RLS: public read; members can write only to their restaurant's folder

**Supabase client wrappers** (`src/lib/supabase/`)
- `client.ts` — browser client via `createBrowserClient`, cached singleton, throws if env missing
- `server.ts` — server client via `createServerClient` (cookie-aware) + admin client using service role
- `types.ts` — typed `Database` schema matching the SQL
- `isSupabaseConfigured()` helper for graceful degradation

**Documentation**
- `supabase/README.md` — step-by-step setup, schema overview, RLS plain-English, storage convention

**Config**
- `.env.example` updated with Supabase URL + anon + service-role keys (Gemini key kept as legacy)

### Tech
- `@supabase/supabase-js@^2.106` + `@supabase/ssr@^0.10` installed
- Lazy client init — no crash if env vars missing (existing pages keep working with localStorage)
- Build still green with 13 routes

---

## [0.7.0] — 2026-05-27

Sprint 4 Phase A. Live streaming progress, owner analytics, and photo upload.

### Added

**Streaming breakdown progress**
- `/api/generate-breakdown` now streams **NDJSON** events: `start` → 6× `layer-start`/`layer-done`/`layer-error` → `complete`
- Wizard reads the stream via `Response.body.getReader()` and updates state live
- New 6-up status grid in the wizard: each layer pulses amber while in progress, turns emerald ✓ when done, rose × on error
- User can see "lime peel done · ice in progress" instead of one big spinner

**Owner analytics dashboard**
- `/admin/analytics` — 4 KPI cards (Total views, Orders, Conversion, Top item)
- Two 30-day sparkline charts (Views in amber, Orders in pink) using inline SVG with gradient fill
- Top items table with views / orders / conversion per cocktail
- 24-hour engagement heatmap (vertical bars, peak intensity in evening + lunch)
- All numbers come from deterministic mock data so demo is stable; replace with real telemetry when backend is wired
- Linked from `/admin` header ("Analytics →")

**Photo upload**
- Wizard hero section now offers **"Upload photo"** alongside AI generation
- Accepts PNG / JPEG / WebP up to 4MB
- Reads as data URL, stored directly in the draft (works for localStorage; later replace with server upload + cloud storage)
- Restaurant owners with their own professional photos can use them directly

### Changed
- Routes total 14 (5 dynamic, 9 static)
- `/api/generate-breakdown` response shape: was JSON body, now NDJSON stream — client must parse line-by-line

### Tech
- NDJSON over SSE for simpler client parsing (no event-source library needed)
- `Response` returns `ReadableStream<Uint8Array>` with `Content-Type: application/x-ndjson` + `X-Accel-Buffering: no` to disable proxy buffering
- Pseudo-random deterministic data generator in analytics for stable visual demo across reloads

---

## [0.6.0] — 2026-05-27

Sprint 3 Phase C. Drafts are now fully editable and exportable — round-trip works end to end.

### Added

**Edit drafts**
- `/admin/[slug]/edit` — dynamic route that loads any draft from localStorage and pre-fills the form
- Reuses the same wizard, including hero regeneration + breakdown regeneration
- Graceful "draft not found" fallback if URL is stale
- "Edit" link added to each draft card on `/admin`

**Reusable form**
- `src/components/admin/CocktailForm.tsx` — extracted the wizard logic so `/admin/new` and `/admin/[slug]/edit` share it
- Props: `mode: 'new' | 'edit'`, `initial?`, `initialLayers?`, `initialHeroPrompt?`, `onSaved`
- Slug is editable in new mode, locked in edit mode
- Save button label adapts ("Save cocktail" vs "Save changes")
- Hero / breakdown buttons relabel to "Regenerate" when initial values exist

**Bulk export**
- "Export all as JSON" button on `/admin` — copies the full drafts array to clipboard (cleaned of internal `draftCreatedAt`/`draftUpdatedAt` metadata)
- "Copy JSON" per card — copies a single draft's clean JSON
- Both show "Copied!" feedback for 1.5s
- The exported JSON drops straight into `CocktailConfig` shape — usable for promoting a draft to hardcoded `MENU` in `src/data/cocktail.ts`

### Changed
- `/admin/new/page.tsx` is now a 30-line wrapper around `CocktailForm` (was ~350 lines)
- Routes total 13 (5 dynamic, 8 static)

### Tech
- `CocktailForm` accepts an optional `initialLayers` so edits preserve previously-generated breakdown layers
- Underscore-prefixed destructuring (`{ draftCreatedAt: _c, ... }`) avoids unused-var warnings while stripping internal fields from exported JSON

---

## [0.5.0] — 2026-05-27

Sprint 3 Phase B. The product now generates entire cocktail breakdowns from a single description, and every cocktail page produces a custom social-share image.

### Added

**Open Graph (social share images)**
- `app/opengraph-image.tsx` — branded card for the home page (1200x630, two-tone "Our Cocktails" with diamond divider, gradient text)
- `app/cocktails/[slug]/opengraph-image.tsx` — per-cocktail dynamic OG card showing title + tagline + category
- `generateMetadata` on each cocktail page sets `openGraph.title/description` + Twitter card metadata
- Sharing a cocktail link to Instagram / WhatsApp / Twitter / iMessage now produces a beautiful preview

**AI 6-layer breakdown pipeline (the moat)**
- `POST /api/generate-breakdown` server route — accepts `{ slug, name, tagline, category }`, generates 6 unique layers via Pollinations + bg-removes each via `@imgly/background-removal-node`, saves to `public/cocktail/drafts/{slug}-{layerId}.png`, returns the layers array
- Each layer's prompt is customized with the cocktail's context (name, tagline, category) so colors and styling adapt
- Fail-soft per layer — falls back to the shared template image if a single layer fails

**Wizard integration**
- New section in `/admin/new` — "3D Breakdown · 6-layer AI (optional)"
- "Generate full breakdown" button — disabled while running, ~60-90s wait
- Live progress copy + warning to keep tab open
- Generated layers shown in a 6-up grid for visual confirmation
- "Regenerate breakdown" if user wants another variation
- Custom layers saved into the draft if generated; otherwise `SHARED_LAYERS` are used

### Changed
- `SHARED_LAYERS` is now exported from `src/data/cocktail.ts` so the API route + wizard can reuse the template
- Routes total 12 (5 dynamic, 7 static), including 2 OG image routes + 1 API route

### Tech
- API route uses `runtime: 'nodejs'` + `maxDuration: 300` to allow long-running generation
- Wizard sends a single POST and waits — no streaming yet (planned for Phase C)
- Generated drafts saved to `public/cocktail/drafts/` — fine for local dev, needs cloud storage in prod (deferred)

---

## [0.4.0] — 2026-05-27

Sprint 3 Phase A. The product is now a working CMS: restaurant staff can compose new cocktails with AI-generated hero images, preview them, and share links.

### Added

**CMS shell**
- `/admin` — restaurant admin page listing all hardcoded cocktails + localStorage drafts
- `/admin/new` — full wizard for composing a new cocktail (name EN/HE, tagline EN/HE, category, dietary flags, flavor profile 0-5 per axis, bartender note EN/HE, AI hero generation)
- Delete-with-confirm on draft cards
- "Preview" link per draft → `/drafts/[slug]`
- `/drafts/[slug]` — client-side route that renders any localStorage draft in the full breakdown experience (handles "not found" gracefully)

**AI hero generation**
- `src/lib/heroPrompts.ts` — `buildHeroPrompt(input)` + `buildPollinationsUrl(prompt)` + `slugify(name)`
- Wizard "Generate with AI" button calls Pollinations directly; image URL is stored on the draft (no server-side processing yet)
- Auto-suggested prompt assembled from name + tagline; user can edit before generation

**Drafts persistence**
- `src/lib/useDrafts.ts` — typed `useDrafts` hook with localStorage persistence (`cocktail-demo:drafts` key)
- `DraftCocktail = CocktailConfig & { draftCreatedAt, draftUpdatedAt }`
- `upsert` / `remove` / `findBySlug` API
- `blankCocktailTemplate(slug)` — sensible defaults for new drafts

**Menu integration**
- Drafts are merged into the home menu alongside hardcoded items
- Card routes split: hardcoded → `/cocktails/[slug]`, drafts → `/drafts/[slug]` (via new `isDraft` prop on `MenuCard`)
- Live count `02 / 04 · Volume I` reflects merged total
- Filter chips + search work across hardcoded + drafts uniformly

**Sharing**
- `ShareButton` component — Web Share API with clipboard fallback ("Link copied" toast on success)
- Mounted in `CocktailScene` top-right alongside language toggle
- Works on hardcoded cocktails and drafts identically

**Navigation chrome**
- "Admin →" link added to home page footer next to "Build Log →"

### Tech
- `useDrafts` hydration pattern (returns `hydrated` flag so callers can avoid flicker)
- Drafts use Pollinations CDN URLs directly — no local storage of image bytes (5MB localStorage limit-friendly)
- Build now includes `/drafts/[slug]` as dynamic (`ƒ`) route since localStorage isn't available at build time
- Total routes: 10 (1 dynamic, 9 static / prerendered)

---

## [0.3.0] — 2026-05-27

Sprint 1 + 2 combined push. The product now feels like a multi-item menu with proper item enrichment.

### Added

**Data layer**
- `Category` type (citrus / smoky / bitter / sweet / mocktail)
- `FlavorProfile` (sweet / bitter / citrus / smoky / herbal — 0-5 scale)
- `DietaryFlags` (vegan / glutenFree / alcoholFree)
- `IngredientLabel.origin` — optional localized brand / source field
- `CocktailConfig.bartenderNote` + `bartenderName` + `flavor` + `category` + `heroPrompt`
- `CATEGORY_LABEL`, `FLAVOR_LABEL` localized dictionaries
- `SHARED_LAYERS` template extracted (3 cocktails share the same 6-layer breakdown for now)

**New cocktails**
- `Smoked Old Fashioned` — bourbon / oak / orange peel, smoky category
- `Garden Spritz` — cucumber / basil / elderflower, alcohol-free mocktail
- Each with its own hero image, flavor profile, bartender note, dietary flags

**Item page enrichment** (`/cocktails/[slug]`)
- `FlavorRadar` — SVG pentagon chart with 5 axes, animated draw, gradient fill (bottom-left corner)
- `BartenderNote` — italic Playfair pull-quote with attribution (bottom-center)
- Ingredient origins inline under each label name ("Tanqueray London Dry", "Pamplemousse Rose, Combier", etc.)

**Home page**
- `MenuFilters` component — search input + category chips + favorites filter
- Category-grouped sections when "All" filter active (each category gets its own header)
- Filtered list view when category / search active
- "No matching items" empty state
- Live count `02 / 03 · Volume I` based on filtered results
- Favorite count in chip label

**Favorites**
- `useFavorites` hook with localStorage persistence
- Heart button on each `MenuCard` (top-right, pink glow when active)
- Toggle button stops Link navigation
- Survives reload and across sessions

**Asset generation**
- `scripts/generate-heroes.ts` — generates hero images only (separate from the 6 breakdown layers)
- `npm run generate:heroes [slug...]` — generate all or specific cocktails
- Smoked Old Fashioned + Garden Spritz hero images generated and bg-removed

### Changed
- Home page now scrollable (vertical) to accommodate multiple cocktails
- Fixed-position decorative corner text now uses `fixed` instead of `absolute` so it stays put on scroll
- Card index uses `MENU.indexOf(cocktail)` so "No. 02" stays correct across filters
- `CocktailScene` adds radar + bartender note alongside existing layers + labels

### Tech
- `src/lib/useFavorites.ts` — typed hook, safe against corrupt storage, persists JSON array of slugs

---

## [0.2.0] — 2026-05-27

Build log and in-app documentation infrastructure.

### Added
- `/changelog` route — in-app build log that reads `CHANGELOG.md` at build time and renders with luxury styling
- `src/lib/parseChangelog.ts` — markdown parser for the changelog format
- "Build Log →" footer link on home page

### Changed
- Removed global `overflow: hidden` from `html, body` so non-scene pages can scroll naturally
- Removed `touch-action: none` from body (kept on canvas only)
- Removed `user-select: none` from body (kept via `select-none` on scene containers)

---

## [0.1.0] — 2026-05-27

First working MVP of the interactive cocktail breakdown experience.

### Added

**Foundation**
- Single source of truth `src/data/cocktail.ts` — typed config for layers, labels, i18n
- Type-safe `LayerConfig`, `IngredientLabel`, `CocktailConfig` with `Localized` strings
- `MENU` array + `findCocktailBySlug()` lookup function

**3D scene (item breakdown view)**
- Vertical layered breakdown (glass at bottom → lime peel at top)
- `CocktailScene` — Three.js canvas, mounted via `next/dynamic` (ssr:false)
- `CocktailLayers` — six planes, each a 3D mesh with texture
- `LuxuryLighting` — soft ambient + animated directional key light
- Per-layer floating animation (sin/cos with independent amplitude/speed)
- Mouse-parallax response with heavy lerp for cinematic feel
- Hover detection on layers via R3F pointer events

**Bidirectional hover (layer ↔ label)**
- Hover a 3D layer → corresponding label glows
- Hover a label → corresponding 3D layer brightens (emissive) and scales up slightly
- Focus mode — when any layer is active, the other layers fade to 20% opacity for cinematic spotlight effect

**Labels**
- `IngredientLabels` — overlay panel of names + descriptions, positioned next to each layer
- Mirror layout: English labels on left of layers, Hebrew labels on right (RTL-aware)
- Drop-shadow glow on active label name
- Number circles + connector lines removed per design feedback (cleaner look)

**Asset generation pipeline**
- `scripts/generate-assets.ts` — generates 6 transparent layer PNGs from text prompts
- Uses **Pollinations.ai** (free, no key) with Flux model
- Background removal via `@imgly/background-removal-node` (local, free, transparent alpha)
- CLI arg support — `npm run generate:assets -- splash_clear` regenerates one layer
- Per-layer prompts crafted to avoid containers/surfaces ("isolated subject on pure black void")

**Internationalization (EN / HE)**
- `LanguageToggle` component — pill-style EN / עב switch top-right
- All text content localized: titles, subtitles, label names, descriptions, taglines
- Font swap per language: Playfair Display (EN) ↔ Frank Ruhl Libre (HE); EB Garamond (EN) ↔ Heebo (HE)
- `dir="rtl"` + `lang="he"` on Hebrew text containers
- Label position mirrors based on language

**Menu landing page**
- New home page `/` — cinematic menu landing
- Route refactor: item breakdown moved to `/cocktails/[slug]`
- `generateStaticParams` for static prerendering of menu items
- `CocktailSceneClient` thin wrapper to allow Server Component pages with dynamic-import scene
- `MenuCard` component — 3D tilting card with hero image, halo glow, reflection beneath
- Mouse-follow shine effect on card hover
- "No. 01" page-number ornament + diamond divider on each card

**Cinematic background FX (`BackgroundFX`)**
- 18 atmospheric floating particles (large, blurred, slow drift — "luxury dust")
- 3 breathing radial gradients (rose / amber / cool blue) for ambient color
- Subtle mouse-follow spotlight (1000px radius, 0.035 alpha — almost subconscious)
- Film grain overlay (6% opacity)
- Top/bottom vignette gradients

**Page chrome**
- Slow editorial marquee at top (120s cycle, 0.7em spacing, 0.25 opacity)
- Vertical corner decorations: "Est. 2026 · House Signature" + "01 / 01 · Volume I"
- Two-tone display title — "Our" with white→amber→bronze gradient + "Cocktails" italic Playfair
- Diamond-flourish dividers throughout

**Typography**
- Google Fonts via `next/font/google`: Playfair Display, EB Garamond, Inter (Latin)
- Frank Ruhl Libre, Heebo (Hebrew)
- All variables exposed as CSS custom properties

### Changed
- Layer scales tightened twice based on design feedback to fit fully in viewport
- Y-positions shifted down 0.25 units for more breathing room above peel
- Particle count halved (36 → 18), made larger, blurrier, slower
- Marquee animation slowed 3x; opacity reduced
- Mouse spotlight intensity reduced ~2x for cinematic restraint
- Title font progression: Cinzel → Playfair Display (more editorial / luxury menu vibe)

### Removed
- Tap-to-explode toggle (originally radial — replaced by static vertical layout)
- Number circles 01-06 on labels (cleaner look without them)
- Connector lines between number and image
- `@fal-ai/client` dependency (switched to free Pollinations + local rembg)

### Tech
- Next.js 16.2.6 (Turbopack)
- React 19.2.4
- React Three Fiber 9 + Drei + Three.js 0.184
- Framer Motion 12
- Tailwind CSS 4
- TypeScript 5 (strict)
- `@google/genai` (installed but unused — kept for future paid Nano Banana use)
- `@imgly/background-removal-node` for transparent PNG generation
- `dotenv` + `tsx` for asset generation scripts
