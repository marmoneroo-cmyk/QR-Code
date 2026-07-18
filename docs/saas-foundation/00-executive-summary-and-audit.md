# 00 — Multi-Tenant SaaS Foundation: Executive Summary & Audit

**App:** `cocktail-demo` · **Audience:** Founder + engineers (read this first) · **Status:** DOCUMENTATION ONLY — no application code was changed.
**Date:** 2026-06-09 · **Verified against:** `supabase/schema.sql`, `src/lib/supabase/{server,restaurant}.ts`, `src/lib/promotions/repository.ts`, `src/app/api/track/route.ts`, and the recon bundle. Every current-state claim cites a file (path + approx line). Anything absent is marked **NOT PRESENT**.

> **Status update (as of this revision).** This audit was written *before* the auth layer existed. Auth has since **landed**, so several headline "no auth" claims below are **stale and are corrected inline**. What is now true:
> - **Authentication exists.** `requireSession()` (`src/lib/auth/guard.ts`) is the single API auth boundary; every sensitive admin/tenant `/api/*` route calls it and derives the tenant from `session.restaurantSlug` — **never** from `?restaurant=` or the request body.
> - **Page middleware exists.** `src/proxy.ts` (Next middleware) refreshes the session and gates `/admin/*` behind login when `AUTH_ENFORCED=true`.
> - **Revenue/analytics reads are gated.** `sales`, `events/raw`, `sessions`, and `analytics/*` GET routes now require a session; they no longer accept `?restaurant=` as an authorization input.
>
> **What still REMAINS (accurately called out below):**
> - (a) The runtime **still uses the service-role client** (`createAdminSupabase()`) for tenant CRUD, so **RLS is NOT yet the live boundary** — the live boundary is app-code (`requireSession()` + hand-written `.eq('restaurant_id', …)`), not `auth.uid()` membership policies. `auth.uid()` is still null in Postgres.
> - (b) `AUTH_ENFORCED` gates the page middleware and **may be off by default in some envs** (`.env.example` ships `AUTH_ENFORCED=false`) — verify per-environment.
> - (c) Rotation of the previously-exposed Supabase secrets may still be **pending — verify**.
> - (d) No `super_admin`/platform role, no billing/`subscriptions`/`plans`, and no security `audit_logs` yet.
>
> Net: **Gate 0 (auth exists) is effectively met; Gate 1 (RLS as the live boundary) is not.** Read the sections below with these corrections applied.

This is the top-level synthesis. The detail lives in five sibling deliverables — read them for the runnable SQL, route-by-route tables, and step-by-step designs:

| Doc | Title | Owns |
|---|---|---|
| [`02-tenant-isolation-and-rls.md`](./02-tenant-isolation-and-rls.md) | Tenant Isolation & Database (RLS) | The three table lists, current RLS status, new-table DDL + RLS, the service-role problem |
| [`03-auth-roles-superadmin.md`](./03-auth-roles-superadmin.md) | Auth, Roles, Permissions & Super Admin | Auth design, middleware, role/permission matrix, `/platform` console, impersonation |
| [`04-onboarding-urls-storage.md`](./04-onboarding-urls-storage.md) | Onboarding, URL Strategy & File Storage | Provisioning, tenant resolution (path/subdomain/custom-domain), per-tenant storage |
| [`05-billing-audit-backups.md`](./05-billing-audit-backups.md) | Billing, Audit Logging & Backups | Plans/`subscriptions`/Stripe, `audit_logs`, soft-delete, PITR & DR runbook |
| [`06-pentest-session-analytics.md`](./06-pentest-session-analytics.md) | Pen-test, Session & Analytics Security | Ranked attack vectors, session/JWT design, analytics tenant-isolation |

---

## 1. Executive Summary / Verdict

**The database is already a well-architected multi-tenant system; the running application enforces none of it.** Every business table carries `restaurant_id NOT NULL` and RLS is enabled on all 10 tables with correct membership-based policies (`supabase/schema.sql:211-335`). That schema is genuinely good — and genuinely **dormant**, because every server data path goes through `createAdminSupabase()`, which uses `SUPABASE_SERVICE_ROLE_KEY` with empty cookies (`src/lib/supabase/server.ts:35-51`, verified) and **bypasses RLS entirely**. **[CORRECTED — see Status update above.]** Application auth **now exists**: `requireSession()` (`src/lib/auth/guard.ts`) gates every sensitive admin/tenant `/api/*` route and derives the tenant from `session.restaurantSlug`, and `src/proxy.ts` (Next middleware) gates `/admin/*` behind login when `AUTH_ENFORCED=true`. **But** because the runtime still calls `createAdminSupabase()` (service-role) for tenant CRUD, `auth.uid()` is still null in Postgres, the membership policies still never run, and the live tenant boundary is app-code — `requireSession()` plus hand-written `.eq('restaurant_id', …)` filters — **not RLS**. (Historically, before auth, the only boundary was a hardcoded `TENANT_SLUG = 'diner'` default at `src/lib/analytics/queries.ts:31`.) What REMAINS exploitable is narrower than originally written: the `updatePromotion`/`deletePromotion` mutators still scope by raw `id` with no `restaurant_id` check (`src/lib/promotions/repository.ts:107-121`, verified) so a member of tenant A could still reach tenant B's promotion by UUID — **verify whether this has since been fixed** — but the write routes (`/api/promotions`, `/api/sales`, `/api/experience`, `/api/changes`) now require a session and take the tenant from it, not the body. `/api/track` remains public **by design** (diners are anonymous) and takes its slug from the body — hardened separately (format allowlist + slug-must-resolve). Beyond isolation, the SaaS scaffolding does not exist yet: **NOT PRESENT** — no `super_admin` role (`role` ∈ `owner|manager|staff`, `schema.sql:35`), no billing/`subscriptions`/`plans`, no security `audit_logs` (`changes` is a per-tenant *content* log), no `invitations`, no soft-delete (hard `on delete cascade` makes a tenant delete irreversible). **Verdict: the foundation is now partly built — a strong schema, auth landed, but RLS is still not the live runtime boundary and there is no platform layer.** Authentication (the original single blocking prerequisite) now exists; the next blocking step is making **RLS the live boundary** by moving tenant CRUD off the service-role client (Gate 1). **Close the remaining service-role/id-scope holes before onboarding a second tenant.**

---

## 2. Architecture Review (current vs target)

**Current — schema is multi-tenant, runtime is single-tenant-by-constant and unguarded:**

> **Note (corrected):** the diagram below depicts the *pre-auth* runtime and is kept for historical context. Today, `/admin/*` is gated by `src/proxy.ts` when `AUTH_ENFORCED=true`, and the `/api/*` write/read routes call `requireSession()` and derive the tenant from the session — not the body/URL. The one part still accurate: tenant CRUD still runs under the **service-role** client, so RLS is still bypassed (the "SERVICE-ROLE ► BYPASSRLS" box below remains true).

```
   anonymous internet user (no login required)
        │
        ▼
   /admin/*  ── OPEN, no gate ──┐         /api/* (track, promotions, sales,
   (src/app/admin/page.tsx:1)   │          experience, changes) ── NO auth
        │                       │              │   tenant = body/param ?? 'diner'
        ▼                       ▼              ▼
   ┌─────────────────────────────────────────────────────┐
   │  createAdminSupabase()  — SERVICE-ROLE key           │
   │  (server.ts:35-51)  ►  BYPASSRLS  ► RLS NOT EVALUATED │
   └─────────────────────────────────────────────────────┘
        │  tenant boundary = TENANT_SLUG='diner' const + .eq('restaurant_id')
        ▼  (app-code only; NOT an authorization control)
   ┌─────────────────────────────────────────────────────┐
   │  Postgres: 10 tables, restaurant_id NOT NULL,        │
   │  RLS ENABLED, membership policies  ◄── correct but   │
   │  never enforced (auth.uid() is always null)          │
   └─────────────────────────────────────────────────────┘
   MISSING entirely: auth · super_admin · subscriptions/plans · audit_logs · invitations · soft-delete
```

**Target — identity-driven, RLS-enforced, with a platform layer:**

```
   user ─► /login (Supabase Auth) ─► signed httpOnly session cookie (JWT)
        │
        ▼
   src/middleware.ts  ── gates /admin/* and mutating /api/*; resolves
   active restaurant_id + role from the SESSION (never from URL/body)
        │                                   │
        ▼ tenant CRUD                       ▼ super_admin only
   ┌──────────────────────────┐     ┌──────────────────────────┐
   │ createServerSupabase()   │     │ /platform/* console       │
   │ anon, cookie-bound       │     │ (platform_admins table)   │
   │ ► RLS ENFORCED via       │     │ impersonation (audited)   │
   │   auth.uid() membership  │     └──────────────────────────┘
   └──────────────────────────┘
        │   service-role reserved for: /api/track ingest (tenant from
        │   SIGNED token, not body) + platform jobs (explicit restaurant_id)
        ▼
   ┌─────────────────────────────────────────────────────┐
   │  Postgres: existing 10 tables (RLS now LIVE)         │
   │  + subscriptions + plans + audit_logs + invitations  │
   │  + platform_admins + soft-delete (deleted_at)        │
   └─────────────────────────────────────────────────────┘
```

The load-bearing change is **"resolve tenant + authorize per request from the session, then let RLS enforce it in the DB."** Everything else (URL shape, billing, audit, storage) layers on top of that one shift. Detail: auth/middleware in [`03`](./03-auth-roles-superadmin.md); client swap and RLS in [`02`](./02-tenant-isolation-and-rls.md).

---

## 3. Current System Audit (what exists, grounded)

| Area | State | Evidence |
|---|---|---|
| Multi-tenant schema | **Present & correct.** 10 tables, all business tables `restaurant_id NOT NULL`, FK→`restaurants` `on delete cascade` | `schema.sql:43,108,140,157,167,179` |
| RLS policies | **Present & correct, but dormant.** Enabled on all 10 tables; membership-based (`exists(... restaurant_members ... user_id = auth.uid())`) | `schema.sql:211-335` |
| Service-role client | **Present — bypasses RLS.** `createAdminSupabase()` uses `SUPABASE_SERVICE_ROLE_KEY`, empty cookies; used by every route/repository | `server.ts:35-51` (verified) |
| Anon/RLS client | **Present but dead code.** `createServerSupabase()` never imported by any route or lib module | `server.ts:5-33` |
| App authentication | **PRESENT (added since audit).** `requireSession()` is the single API auth boundary; `getSessionContext()` derives tenant from the session | `src/lib/auth/guard.ts`; `src/lib/auth/session.ts` |
| `/admin/*` gating | **PRESENT when `AUTH_ENFORCED=true`.** `src/proxy.ts` (Next middleware) gates `/admin/*` behind login; enforcement is **off by default** (`AUTH_ENFORCED !== 'true'`) — verify per env | `src/proxy.ts:46`; `.env.example:24` |
| Role enforcement | **NOT PRESENT** — no code reads `restaurant_members.role`; `role` hits in `admin/**` are ARIA only | recon `auth-ui-session` §2; `schema.sql:35` |
| Tenant resolution | Hardcoded `TENANT_SLUG='diner'` default; slug→UUID via service-role `getRestaurantId()` (process-cached) | `analytics/queries.ts:31`; `restaurant.ts:7-15` |
| Cross-tenant write holes | `updatePromotion`/`deletePromotion` filter `.eq('id', id)` only — no `restaurant_id` | `promotions/repository.ts:107-121` (verified) |
| `/api/track` ingest | Public by design (sole `events` writer; no public insert policy); tenant from body `restaurantSlug ?? 'diner'`; no auth, no rate limit | `track/route.ts:76,98` |
| Super admin / platform role | **NOT PRESENT** — `role` constrained to `owner|manager|staff` | `schema.sql:35` |
| Billing / `subscriptions` / `plans` | **NOT PRESENT** — no table, no Stripe, no entitlement resolver | recon `db-rls` §3 |
| Security `audit_logs` | **NOT PRESENT** — `changes` is a per-tenant *content* log (no actor/IP/UA) | `schema.sql:177-188`; migration `_archive/0010` |
| `invitations` | **NOT PRESENT** — `restaurant_members` has no insert RLS policy (onboarding needs service-role) | `schema.sql:231-233` |
| Soft-delete | **NOT PRESENT** — hard `on delete cascade`; tenant delete is irreversible short of PITR | `schema.sql:33,43,108` |
| Storage bucket | Declared (`cocktail-assets`, public-read, member-scoped writes) but **never used** — no `storage.from().upload()` in `src/**`; assets live in flat public `public/cocktail/*` + inline base64 | `schema.sql:374-409`; recon `analytics-storage` §2 |
| Experiments table | **NOT PRESENT** — A/B is events-derived (`getExperimentResults` reads `events`) | `experiments/results.ts:6,36` |
| Backups / PITR | **NOT MANAGED IN REPO** — Supabase platform setting, no IaC asserts a policy | recon; `05` §3.1 |

---

## 4. Security Audit Summary (top findings, ranked)

Severity uses the project scale (Critical = cross-tenant compromise / data loss). Full exploit steps and remediation detail in [`06-pentest-session-analytics.md`](./06-pentest-session-analytics.md). **[CORRECTED]** This table was written pre-auth, when every finding was exploitable with no credentials. With `requireSession()` + `src/proxy.ts` now live (and `AUTH_ENFORCED=true`), findings that depended on "no auth exists" (#2, #3, #5) are **mitigated at the route layer** — each row is annotated below. The isolation findings that live *below* the auth layer (#1 id-scope, #4 RLS-not-live) are **not** fixed by auth and remain open.

| # | Finding | Severity | One-line remediation | Detail |
|---|---|---|---|---|
| 1 | Cross-tenant promotion write/delete via raw `id` — `updatePromotion`/`deletePromotion` have no `restaurant_id` scope (`promotions/repository.ts:107-121`) | **Critical** | Filter `.eq('id',id).eq('restaurant_id', sessionRestId)`; better, run under the RLS client | [`06` V1](./06-pentest-session-analytics.md) |
| 2 | ~~Unauthenticated tenant-targeted writes~~ — **MITIGATED:** `promotions`/`sales`/`experience`/`changes` POST/PUT now call `requireSession()` and take tenant from `session.restaurantSlug`, not the body | ~~Critical~~ → resolved at route layer | Done via `requireSession()` (`src/lib/auth/guard.ts`) | [`06` V2](./06-pentest-session-analytics.md) |
| 3 | ~~Open `/admin/*`~~ — **MITIGATED when `AUTH_ENFORCED=true`:** `src/proxy.ts` gates `/admin/*` behind login. **Verify** the flag is on in each env (off by default) | ~~Critical~~ → resolved when enforced | `src/proxy.ts` middleware gate | [`06` V3](./06-pentest-session-analytics.md) |
| 4 | RLS never enforced at runtime — service-role everywhere, `auth.uid()` null | **Critical (OPEN)** | Route tenant CRUD through `createServerSupabase()` (anon, cookie-bound) | [`06` V4](./06-pentest-session-analytics.md), [`02` §4](./02-tenant-isolation-and-rls.md) |
| 5 | ~~Unauthenticated revenue/PII read exfiltration~~ — **MITIGATED:** `sales` GET, `events/raw`, `sessions`, `overview` now require a session and no longer accept `?restaurant=` | ~~High~~ → resolved at route layer | Done — read routes gated behind `requireSession()` | [`06` V5](./06-pentest-session-analytics.md) |
| 6 | No role enforcement — `restaurant_members.role` never read; every member would be all-powerful once auth lands | **High** | Enforce owner>manager>staff matrix in RLS `WITH CHECK` + handlers | [`06` V6](./06-pentest-session-analytics.md), [`03` §4](./03-auth-roles-superadmin.md) |
| 7 | SSRF via `scrape-restaurant` — user `url` into server fetch, no allowlist/private-IP block | **High** | `https`-only allowlist; block private/link-local/loopback; require auth | [`06` V7](./06-pentest-session-analytics.md) |
| 8 | Analytics pollution via `/api/track` — body slug, no auth, no rate limit, unknown tenant silently 200s | **Medium** | Bind tenant to a signed QR/menu token; per-IP/session rate limit; alert on unknown slug | [`06` V8](./06-pentest-session-analytics.md) |
| 9 | Path traversal + unauth FS writes in image routes — `generate-breakdown` builds filename from unsanitized `body.slug`; both fetch outbound with `maxDuration=300` | **Medium** | `slugify` + `^[a-z0-9-]+$`; pin outbound host; cap bytes/concurrency; auth | [`06` V9](./06-pentest-session-analytics.md) |
| 10 | Tenant-existence enumeration via timing/silent-accept on `/api/track` | **Low** | Uniform constant-time responses; rate-limit | [`06` V10](./06-pentest-session-analytics.md) |
| 11 | Storage bucket cross-tenant asset enumeration (latent — bucket public-read, currently unused) | **Low** | Make private; signed URLs; randomized, tenant-namespaced keys | [`06` V11](./06-pentest-session-analytics.md) |

**Single root cause for #1–#5 was:** service-role bypass (`server.ts:35-51`) + no auth layer. The auth layer now exists, so #2/#3/#5 have collapsed at the route layer; what remains is the **service-role bypass** (#4) — until tenant CRUD moves off `createAdminSupabase()`, RLS stays dormant and the app-code `.eq('restaurant_id')` filter (#1) is the only thing standing between tenants.

---

## 5. Tenant Isolation Audit Summary (the three table lists at a glance)

Full version with per-column policy citations and runnable SQL in [`02-tenant-isolation-and-rls.md`](./02-tenant-isolation-and-rls.md) §1.

**5A. PROTECTED — tenant-scoped *and* RLS-enabled (schema is correct).** All business tables are here. "Protected" = the schema is right; §4 of [`02`](./02-tenant-isolation-and-rls.md) explains why it is bypassed at runtime.

> `restaurants`, `restaurant_members`, `cocktails`, `cocktail_layers`*, `cocktail_labels`*, `events`, `promotions`, `menu_experience`, `sales`, `changes` — plus the `cocktail_funnel` view (`security_invoker=true`) and the `cocktail-assets` storage bucket. (*`layers`/`labels` are scoped indirectly via `cocktail_id`→`cocktails`.) Citations: `schema.sql:211-335,341-353,374-409`.

**5B. UNPROTECTED at runtime — reachable cross-tenant (needs an authorization control, not a schema fix).** The rows *are* tenant-scoped; the *code path* defeats the schema.

> `updatePromotion`/`deletePromotion` (`id`-only, `repository.ts:107-121`); child layer/label deletes (`cocktail_id`-only); `/api/track` (body slug); all tenant-write API routes (`promotions`/`sales`/`experience`/`changes`); all analytics GET routes (default `'diner'` today, but lib fns accept `restaurantSlug` under service-role). **Root cause:** service-role bypass + no auth.

**5C. NEEDS MIGRATION — add `restaurant_id` / fix scope.** **None among existing business tables** — every one already carries `restaurant_id NOT NULL` with FK + cascade; `layers`/`labels` are intentionally indirect. What is missing is **net-new platform tables** (all NOT PRESENT today): `plans`, `subscriptions`, `audit_logs`, `platform_admins`, `invitations`. DDL + RLS for each is in [`02` §5](./02-tenant-isolation-and-rls.md) and [`05`](./05-billing-audit-backups.md).

---

## 6. Definition of Done — Foundation Gates

These gates must **all** pass before net-new product features resume. They are ordered by dependency; auth is the prerequisite for the rest.

**Gate 0 — Authentication exists.**
- [ ] Supabase Auth wired; `/login` + logout routes exist; `src/middleware.ts` gates all `/admin/*` and all mutating `/api/*` (`03` §2).
- [ ] An anonymous request to `/admin/*` and to every tenant-write API route is rejected (302/401), verified by test.

**Gate 1 — RLS is the live enforcement boundary.**
- [ ] All tenant CRUD runs through `createServerSupabase()` (anon, cookie-bound); `createAdminSupabase()` is reserved for `/api/track` ingest and explicit platform jobs only (`02` §4).
- [ ] Contract test: seed two tenants, assert every analytics/repository function returns only tenant-A rows for A and zero B-leakage (`06` §3.3).

**Gate 2 — Tenant is session-derived, never client-supplied.**
- [ ] Active `restaurant_id` comes from the verified session; `?restaurant=`/`body.restaurant` is ignored (or 403 on mismatch) for authorization (`06` §2.1).
- [ ] The duplicated `'diner'` literals are replaced by one server-side resolver; default params removed so a missing tenant is a compile error (`06` §3.3).

**Gate 3 — The known cross-tenant holes are closed.**
- [ ] `updatePromotion`/`deletePromotion` (and child layer/label deletes) scope by `restaurant_id` (`06` V1).
- [ ] `/api/track` binds tenant to a signed QR/menu token + per-IP/session rate limit; SSRF allowlist on `scrape-restaurant`; `body.slug` sanitized in image routes (`06` V2,V7,V8,V9).

**Gate 4 — Roles & super_admin enforced.**
- [ ] owner/manager/staff permission matrix enforced in RLS `WITH CHECK` and handlers (`03` §4).
- [ ] `platform_admins` + `is_platform_admin()` exist; `/platform` console gated; impersonation (if built) is short-lived, banner-flagged, and audited (`03` §5,§7).

**Gate 5 — Platform data model in place.**
- [ ] `subscriptions` + `plans` + server-side entitlement resolver (deny-by-default; 402/403 on gated capability) (`05` Part 1).
- [ ] `audit_logs` (append-only, actor/IP/UA) writing the high-value events: role change, billing change, impersonation, tenant delete, export (`05` Part 2).
- [ ] `invitations` table + owner/manager insert policy so onboarding does not need service-role (`02` §5.5, `04` §1.5).

**Gate 6 — Data safety & recovery.**
- [ ] Soft-delete (`deleted_at`) on `restaurants` (+ RLS respects it) so tenant deletion is reversible (`05` §3.4).
- [ ] Supabase PITR enabled (≥7-day window) + per-tenant export/restore path; DR runbook documented out-of-repo (`05` §3).

**Done = Gates 0–4 green (security/isolation) before any new tenant is onboarded; Gates 5–6 green before charging money or scaling tenant count.**

---

*All current-state claims verified against `supabase/schema.sql`, `src/lib/supabase/{server,restaurant}.ts`, `src/lib/promotions/repository.ts`, `src/app/api/track/route.ts`, and the recon bundle. `createAdminSupabase()` service-role bypass and the `id`-only promotion mutators were re-verified directly. Designs referenced here are proposals in the sibling docs; no application code was modified.*
