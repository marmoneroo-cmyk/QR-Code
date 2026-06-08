# Session Handoff — cocktail-demo (state @ 2026-06-06)

Concise project state so the chat can be cleared without losing context.
Deploy: https://cocktail-demo-delta.vercel.app · Supabase ref `fihaaolredpqbdrdpuca` (eu).

## ✅ Live & verified (demo-ready)
- **Diner app:** luxury menu, per-cocktail breakdown (exploded layers), AR, QR, print kit, restaurant import.
- **Aperol Spritz videos** (replaced 360°, which is fully removed from cocktails):
  - Menu card: hover (desktop) **and** ▶ play button (mobile, outside the `<Link>` so it never opens the breakdown) → plays `diner-aperol-spritz-hover.mp4`.
  - Cocktail page (desktop + mobile): **▶ Video** button → fullscreen modal of `diner-aperol-spritz-feature.mp4`.
  - Files: `public/cocktail/video/*`; helpers `getHoverVideo`/`getFeatureVideo` in `src/data/cocktail.ts`.
- **OrderBar** (Add to order / Call waiter, in-app conversion) — now on **both** desktop & mobile (`CocktailScene` + `MobileCocktailScene`).
- **Analytics pipeline (Phases 1–5):** event tracking → `/api/track` (service-role, resilient) → Supabase `events`. Admin screens: `/admin/analytics`, `/menu-engineering`, `/experiments` (A/B), `/tables`, `/crm`, `/recommendations`, `/executive`, `/journeys`, `/events` (Raw Inspector), `/signals` (Signal Verification + Engine Readiness gate).
- All counting = **unique sessions**; revenue/profit snapshot `priceAtOrder`/`costAtOrder` per order. Attribution: `source` vs `origin` (table_qr vs viral). Verified: multi-user growth + exact math, mobile buttons, no console errors. Test data cleaned.

## ⏳ Pending (gated — do NOT skip)
1. **Run `supabase/migrations/0006_visitor_id.sql`** in Supabase SQL editor (adds `events.visitor_id` column). Sandbox can't reach the DB; user runs it.
2. Collect ~7–14 days of real traffic; watch `/admin/signals` (coverage · health · trend · drift).
3. **Engagement Engine NOT built yet** — by design. Build only after `/signals` "Engine Ready = YES" for 7 consecutive days, then a Signal Audit. Model is fully spec'd & locked in `docs/ENGAGEMENT_INTELLIGENCE_MODEL.md` (eii-1.0).

## 🔑 Key docs
- `docs/ENGAGEMENT_INTELLIGENCE_MODEL.md` — locked scoring model (Menu Engagement / Guest Interest / Purchase Intent / Word-of-Mouth) + Opportunity Preview + eii-1.1 roadmap.
- `docs/INTELLIGENCE_PLATFORM.md` — analytics architecture & phases.
- `docs/ADMIN_OVERVIEW.md` — admin screens reference.
- `CHANGELOG.md` — authoritative shipped history.

## 🔒 Security TODO
Rotate the exposed Supabase `service_role` + DB password (used to apply migrations/cleanup); they're in `.env.local` (gitignored).

## Verify cadence
`npx tsc --noEmit` → `npx next build` → `vercel --prod --yes`. Preview MCP (`cocktail-dev`, port 4321) for real-browser mobile checks. Playwright MCP bridge NOT installed in this env.
