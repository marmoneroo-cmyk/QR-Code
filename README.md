# 🍸 Interactive Cocktail Menu + Restaurant Optimization Platform

A luxury, bilingual (English / עברית · RTL) interactive cocktail menu with an immersive **3D ingredient breakdown** for guests, plus a full **restaurant menu-optimization admin platform** for owners — analytics, recommendations, A/B tests, promotions, and a closed measurement loop, all derived from real anonymous engagement (no fabricated numbers).

> תפריט קוקטיילים אינטראקטיבי יוקרתי עם פירוק תלת-ממדי לסועד, ופלטפורמת ניהול ואופטימיזציה למסעדה.

**Live:** https://cocktail-demo-delta.vercel.app

---

## ✨ What's inside

### Guest experience (public)
- **Immersive 3D cocktail breakdown** (React Three Fiber) — explore each drink's layers/ingredients.
- **Bilingual EN/HE** with full RTL, persisted per device.
- Menu filters, mood filter, search, favorites, "recently viewed", time-of-day hints, top picks.
- **QR per cocktail / per table** → scan jumps straight to the 3D experience.
- Polished motion throughout (Framer Motion), accessible (respects `prefers-reduced-motion`).

### Owner platform (`/admin`, ~24 screens)
- **Home** icon launcher + **Executive** advisor (AI "morning briefing", before→after, projections labeled as estimates).
- **Opportunities** (actionable task list), **Closed Loop** (recommendation → action → measured result), **Analytics** (real SVG area charts + period selector), **Menu Engineering** (interactive 2×2 matrix), **Tables** (floor plan), **Journeys** (funnel stepper), **Heatmap** (page-attention overlay), **Recommendations**, **Experiments** (A/B), **CRM**, **Signals** (instrumentation readiness).
- **Actions:** Promotions (live preview), Experience builder (phone-frame preview), Sales import (CSV drag-drop + treemap), Events inspector (filter chips + live-tail).
- **Setup:** Composer (drag-to-reorder menu), QR codes, Print kit, Restaurant import.
- Shared **luxury dataviz primitives** (`src/components/ui/dataviz.tsx`): count-up KPIs, smooth `AreaChart`, skeletons, live indicators.

All admin numbers come from real anonymous events — projections are always labeled as estimates.

---

## 🧱 Tech stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** · **Framer Motion 12**
- **React Three Fiber / Drei / Three.js** (3D)
- **Supabase** (optional — Postgres + storage; drafts default to `localStorage`)
- **Vitest** (unit tests) · **Vercel** (hosting)

## 🚀 Getting started

```bash
npm install
cp .env.example .env.local   # fill in your own values (never commit .env.local)
npm run dev                  # http://localhost:3000  (this repo's dev server runs on :4321 via .claude/launch.json)
```

### Scripts
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Vitest watch mode |
| `npm run import:restaurant` | Import a restaurant menu (see `scripts/`) |

## ⚙️ Configuration

All secrets live in `.env.local` (git-ignored). See **`.env.example`** for the required keys
(Supabase URL/keys are optional — without them the app runs on `localStorage` drafts).
To enable Supabase-backed drafts: `NEXT_PUBLIC_USE_SUPABASE_DRAFTS=true` (requires member auth + RLS).

## 🗂️ Project structure

```
src/
  app/                 # routes — public menu, /cocktails/[slug], /kiosk, /scan, /admin/*, /changelog
  components/          # MenuCard, 3D scene, admin UI (AdminShell, dataviz, motion), forms
  lib/                 # analytics, tracking, store (local/supabase), optimization, scheduling, hooks
  data/                # cocktail menu (MENU), experience, stories
supabase/              # schema.sql (consolidated) + archived migrations
docs/                  # architecture + product docs
```

## 🧪 Testing

```bash
npm test
```
Vitest unit tests cover pure logic (event labels, deltas, menu ordering, scheduling, promotions, recommendations, mood, opportunities, experience, closed-loop measurement).

## 🌍 Internationalization

UI language is global and persisted (`cocktail-demo:lang`); both the guest menu and admin are fully bilingual EN/HE with RTL. The changelog page is bilingual via `CHANGELOG.md` + `CHANGELOG.he.md`.

## 🚢 Deployment

Deployed on **Vercel**:
```bash
vercel --prod
```

## 🔐 Security

- No secrets are committed — only `.env.example` (placeholders) is tracked.
- If any credential is ever exposed, rotate it immediately — see **`docs/SECURITY-rotate-secrets.md`**.

## 📜 Changelog

See **`CHANGELOG.md`** (English) / **`CHANGELOG.he.md`** (Hebrew) — also rendered in-app at `/changelog`.
