# 03 — Authentication, Roles, Permissions & Super Admin

**Multi-Tenant SaaS Foundation Audit — cocktail-demo**
Audience: founder + engineers · Status: **proposal / design** (no application code is changed by this document)
Last verified against source: 2026-06-09

> **Integrity note.** Every "current state" claim below cites a real file (path + line). Anything absent is marked **NOT PRESENT**. The database is already multi-tenant with membership-based RLS; the entire gap is at the **runtime/application** layer.

---

## 1. Current State — There Is No Authentication

The DB is multi-tenant and RLS-protected, but **nothing at runtime ever authenticates a user or runs as a member**, so RLS is never exercised. The whole `/admin/*` surface and every write API is publicly reachable.

### 1.1 What exists in the database (works, but unused at runtime)

| Object | Evidence | State |
|---|---|---|
| `restaurants` tenant table | `supabase/schema.sql:20-28` | Present |
| `restaurant_members(restaurant_id, user_id→auth.users, role)` | `supabase/schema.sql:31-38` | Present |
| Role constraint `check (role in ('owner','manager','staff'))` | `supabase/schema.sql:35` | Present — **no `super_admin`** |
| RLS enabled on all 10 business tables | `supabase/schema.sql:211-220` | Present |
| Membership-based RLS policies (`exists(select 1 from restaurant_members …)`) | `supabase/schema.sql` policy block | Present |
| Storage bucket `cocktail-assets`, member-scoped writes by slug folder | `supabase/schema.sql:375-403` | Present (migration archived, **never called by code**) |

### 1.2 What is missing at runtime (the actual problem)

| Concern | Finding | Evidence |
|---|---|---|
| Route gating middleware | **NOT PRESENT — no `middleware.ts`** in repo root or `src/` | Glob `**/middleware.ts` → no files |
| Admin layout gate | **NOT PRESENT — no `src/app/admin/**/layout.tsx`** | Glob → no files |
| Auth module / login page | **NOT PRESENT — no `src/lib/auth/**`, no `login`/`signin`/`signup` route**, no `next-auth` | recon:auth-ui-session |
| Supabase user session read | **NOT PRESENT — no `getSession`/`getUser`/`signInWith`** anywhere in `src/**` | recon:auth-ui-session |
| Role enforcement (`owner/manager/staff`) | **NOT PRESENT — no code reads `restaurant_members.role`**; "role" hits are ARIA only | recon:auth-ui-session §2 |
| Super-admin / platform role | **NOT PRESENT** — role constraint excludes it | `supabase/schema.sql:35` |
| Logout / sign-out | **NOT PRESENT** (nothing to log out of) | recon:auth-ui-session §4 |

### 1.3 Why RLS is dead code today: the service-role bypass

Two server clients exist in `src/lib/supabase/server.ts`:

- `createServerSupabase()` — anon key, cookie-aware, **subject to RLS** (`server.ts:5-33`). **Never imported by any data module or route** (dead code).
- `createAdminSupabase()` — `SUPABASE_SERVICE_ROLE_KEY`, **bypasses all RLS** (`server.ts:35-51`).

**Every** server-side read/write goes through the service-role client (analytics, repositories, `/api/track`, and tenant resolution in `restaurant.ts:10`). Tenant isolation therefore depends entirely on app code (a hardcoded `'diner'` default + explicit `.eq('restaurant_id', …)` filters), **not** on the database. Two mutators are not even scoped: `updatePromotion`/`deletePromotion` filter `.eq('id', id)` only with **no `restaurant_id` check** (`src/lib/promotions/repository.ts:110,119`) — cross-tenant editable/deletable by anyone who knows a UUID.

Every write route already carries an explicit self-acknowledgement of the gap, e.g.:

```ts
// src/app/api/sales/route.ts:21
// NOTE (Phase 2): gate behind restaurant-member auth once login is wired.
```

(Same comment on `promotions/route.ts`, `experience/route.ts`.)

**Net current posture:** a public, unauthenticated `/admin` backed by a service-role key that bypasses RLS, linked openly from the public menu (`SettingsToolbar.tsx → /admin/revenue`). The multi-tenant DB is real but **entirely unenforced at runtime**.

---

## 2. Auth Design — Supabase Auth + `restaurant_members`, Tenant/Role From the JWT

### 2.1 Principles

1. **Identity source of truth = Supabase Auth** (`auth.users`). Reuse the existing FK `restaurant_members.user_id → auth.users(id)` (`schema.sql:34`).
2. **Tenant + role come from the verified user, never from mutable client state.** Today the tenant is a request-supplied slug (`sales/route.ts:13,30`; `track/route.ts:76`) — that must stop being authoritative.
3. **Stop bypassing RLS for member-scoped operations.** Use the RLS-respecting client (already present as `createServerSupabase`, `server.ts:5`) for all member reads/writes; reserve service-role for narrowly-audited platform tasks (event ingest, super-admin tooling).
4. **Defense in depth:** middleware gate **and** RLS **and** explicit `.eq('restaurant_id', …)` — no single layer is the only control.

### 2.2 Where tenant + role live

Two complementary mechanisms; implement (A) first, add (B) as an optimization.

**(A) Server tenant-resolver (authoritative, recommended baseline).** Resolve membership from `restaurant_members` for the authenticated `auth.uid()` on each request. No trust in client input.

```sql
-- For the logged-in user, return their tenant(s) + role. Runs under RLS.
select restaurant_id, role
from restaurant_members
where user_id = auth.uid();
```

**(B) Custom JWT claims (fast path, optional).** Mirror membership into the access token via a Supabase Auth Hook so middleware can authorize without a DB round-trip. Claims are **server-issued and signed** — never client-writable.

```jsonc
// access_token app_metadata (issued by a Supabase custom-access-token hook)
{
  "app_metadata": {
    "restaurant_id": "…uuid…",   // active tenant
    "role": "owner",              // owner | manager | staff
    "is_super_admin": false,      // platform staff flag (see §3)
    "memberships": [              // if a user belongs to multiple tenants
      { "restaurant_id": "…", "role": "owner" }
    ]
  }
}
```

> If a user can belong to multiple restaurants, the JWT carries `memberships[]`; the **active** `restaurant_id` is chosen server-side (default = first/only membership, or an explicit, server-validated tenant switch — see §3 active-tenant cookie). The active tenant is set in a signed cookie/JWT, **never** read from a query param.

### 2.3 Next.js middleware that gates `/admin` and injects tenant context

Introduce the currently-absent `src/middleware.ts` (**NOT PRESENT today** — Glob confirms). It must:

1. Read the Supabase session from cookies (the `@supabase/ssr` cookie plumbing already exists in `server.ts:17-31`).
2. Redirect unauthenticated users away from `/admin/*` and `/platform/*` to a new `/login`.
3. Resolve the active `restaurant_id` + `role` (claims from §2.2B or resolver §2.2A).
4. Inject tenant context into downstream handlers via **trusted request headers** (set server-side, stripped from inbound), so server components/route handlers read tenant from context, not from the URL.
5. Block `/platform/*` unless `is_super_admin` (see §5).

```ts
// src/middleware.ts  — PROPOSAL (not implemented)
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(/* url, anonKey, cookie adapter over req/res */);

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  const needsAuth = path.startsWith('/admin') || path.startsWith('/platform');
  if (needsAuth && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (path.startsWith('/platform') && !user?.app_metadata?.is_super_admin) {
    return NextResponse.redirect(new URL('/admin', req.url)); // 403-style bounce
  }

  // Inject trusted, server-derived tenant context (NOT from query/body)
  if (user) {
    res.headers.set('x-tenant-id', String(user.app_metadata?.restaurant_id ?? ''));
    res.headers.set('x-tenant-role', String(user.app_metadata?.role ?? 'staff'));
  }
  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/platform/:path*', '/api/((?!track).*)'],
};
```

> **Important:** `/api/track` stays public (it is the only writer for `events` by design — schema has no public-insert policy; `track/route.ts` uses service-role), but it must **stop trusting `restaurantSlug` from the body unconditionally** and add rate-limiting / per-IP caps. All *other* `/api/*` write routes move behind the middleware and re-derive tenant from the session.

### 2.4 Migration to make existing routes safe

For every member-scoped route currently reading tenant from the request:

- `sales/route.ts:13,30`, `promotions/route.ts`, `experience/route.ts`, `changes/route.ts` → replace `?? 'diner'` and body `restaurant` with the **session-derived** tenant from middleware context.
- Add `restaurant_id` scoping to `updatePromotion`/`deletePromotion` (`promotions/repository.ts:94,117`) — pass and filter on the active tenant, fixing the cross-tenant write hole.
- Swap `createAdminSupabase()` → `createServerSupabase()` for member operations so RLS becomes a real backstop.

---

## 3. Role Matrix (at a glance)

`super_admin` is a **new platform role** that does **not** live in `restaurant_members.role` (whose constraint is `owner|manager|staff`, `schema.sql:35`). Model it as a separate flag/table (see §5).

| Capability area | `super_admin` (platform) | `owner` (tenant) | `manager` (tenant) | `staff` (tenant) |
|---|---|---|---|---|
| Scope | **All tenants** (cross-tenant) | One tenant | One tenant | One tenant |
| Menu / cocktails CRUD | ✅ (via impersonation, audited) | ✅ | ✅ | 👁 view + draft only |
| View analytics (aggregate) | ✅ | ✅ | ✅ | ✅ |
| View sensitive revenue/sales | ✅ | ✅ | ✅ | ❌ |
| Manage promotions | ✅ (impersonation) | ✅ | ✅ | ❌ |
| Manage staff & managers | ✅ (any tenant) | ✅ (incl. managers) | ➕ staff only | ❌ |
| Manage owners | ✅ | ➖ (transfer only) | ❌ | ❌ |
| Billing / subscription | ✅ (platform-side) | ✅ | ❌ | ❌ |
| Platform settings | ✅ | ❌ | ❌ | ❌ |
| Impersonate a tenant | ✅ | ❌ | ❌ | ❌ |
| Export / import data | ✅ | ✅ | ✅ (no billing export) | ❌ |
| Disable / delete a tenant | ✅ | ❌ (self-close via support) | ❌ | ❌ |

Legend: ✅ full · 👁/➕/➖ partial · ❌ none.

---

## 4. Permissions Matrix (capability × role)

Authorization is **deny-by-default**. `staff` is intentionally minimal (front-of-house). Sensitive money data is owner/manager only. Billing is owner-only at tenant level.

| Capability | super_admin | owner | manager | staff |
|---|:--:|:--:|:--:|:--:|
| Menu CRUD (create/update/publish cocktails, layers, labels) | ✅* | ✅ | ✅ | ❌ (view/draft) |
| View analytics (funnel, overview, heatmap, tables, sessions) | ✅ | ✅ | ✅ | ✅ |
| View **sensitive revenue/sales** (`sales`, profit KPIs, raw events) | ✅ | ✅ | ✅ | ❌ |
| Manage promotions (create/update/delete) | ✅* | ✅ | ✅ | ❌ |
| Manage menu-experience config | ✅* | ✅ | ✅ | ❌ |
| Manage staff (invite/remove `staff`) | ✅ | ✅ | ✅ | ❌ |
| Manage managers (invite/remove `manager`) | ✅ | ✅ | ❌ | ❌ |
| Manage/transfer ownership | ✅ | ✅ (transfer) | ❌ | ❌ |
| **Billing** (plan, payment method, invoices) | ✅ (platform) | ✅ | ❌ | ❌ |
| **Platform settings** (plans, feature flags, global config) | ✅ | ❌ | ❌ | ❌ |
| **Impersonation** (act as a tenant) | ✅ | ❌ | ❌ | ❌ |
| Export data (CSV/analytics) | ✅ | ✅ | ✅ | ❌ |
| Import data (POS sales, menu import/scrape) | ✅* | ✅ | ✅ | ❌ |
| Disable / enable / delete a tenant | ✅ | ❌ | ❌ | ❌ |

`*` super_admin performs tenant-scoped data actions **through impersonation** (§7), which is fully audited; direct cross-tenant data mutation outside impersonation should be reserved for break-glass tooling only.

**Today none of this is enforced** — all capabilities are open to anonymous callers (recon:api-routes, recon:auth-ui-session). This matrix is the target.

---

## 5. Super Admin Area — Separate Namespace

The platform/operator console must be a **distinct namespace from tenant dashboards** so its routing, layout, and authorization are physically separate from `/admin/*` (the per-restaurant app).

- **Recommended route root:** `/platform` (alias `/superadmin` acceptable). Tenant app stays at `/admin/*`.
- **Gate:** middleware (§2.3) blocks `/platform/*` unless `app_metadata.is_super_admin === true`.
- **Role storage:** since `restaurant_members.role` cannot hold `super_admin` (`schema.sql:35`), add a dedicated table (proposal):

```sql
-- PROPOSAL — new platform-staff table (not implemented). CANONICAL definition of platform_admins.
create table platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'admin' check (role in ('admin','support','read_only')),
  note        text,                                  -- optional free-text note (e.g. why granted)
  created_at  timestamptz not null default now()
);
-- the custom-access-token hook sets app_metadata.is_super_admin = exists(...)
```

> **Canonical schema.** This is the source-of-truth shape for `platform_admins` (columns: `user_id` PK, `role`, `note`, `created_at`). Doc 02 §3.0 mirrors it. The `role` column tiers platform staff (`admin`/`support`/`read_only`); RLS-bypass helpers such as `is_platform_admin()` only test existence by `user_id`, so they remain correct regardless of `role`.

### Screens

| Screen | Purpose | Backed by (today / proposed) |
|---|---|---|
| **Restaurants List** | All tenants, search/filter, lifecycle actions | `restaurants` (`schema.sql:20`) + counts from `restaurant_members`, `events` |
| **Restaurant Details** | Single-tenant drill-down: users, plan, usage, recent activity, audit | joins across tenant tables |
| **Subscriptions** | Plan/state per tenant, MRR, churn | **NOT PRESENT — no subscriptions/plans/billing table** (proposed in doc 04) |
| **Signups** | New-tenant onboarding pipeline | `restaurants.created_at` + proposed `invitations` |
| **System Health** | DB/API/storage/queue status, error rates | proposed (observability), partly from infra |
| **Usage** | Per-tenant event volume, active users, asset storage | derived from `events`, `cocktail_funnel` |
| **Platform Revenue** | Aggregate MRR/ARR across tenants | **NOT PRESENT** — needs billing tables (doc 04) |
| **Failed Imports** | Errors from `import-restaurant` / `scrape-restaurant` / POS `sales` import | **NOT PRESENT — no import-job/error table**; routes write to FS only |
| **Support Tools** | Impersonation launcher, resend invite, reset, manual fixups | proposed (uses §7 impersonation) |
| **Security Alerts** | Failed logins, suspicious cross-tenant attempts, anomalous `/api/track` volume | **NOT PRESENT — no `audit_logs`** security table (`changes` is a per-tenant *content* log, `0010`); needs new audit store |

> Several screens depend on tables that are **NOT PRESENT today** (subscriptions/plans/billing, platform `audit_logs`, import-job log). Those are specified in the companion data-model deliverable (doc 04); this doc references them as dependencies, not implementations.

---

## 6. Restaurants List — Spec

Primary super-admin screen at `/platform/restaurants`.

### Columns

| Column | Source | Notes |
|---|---|---|
| **Name** | `restaurants.name` (`schema.sql:23`) | links to Restaurant Details |
| **Status** | proposed `restaurants.status` (active/disabled/trial) | **NOT PRESENT today** — add column/lifecycle |
| **Plan** | proposed `subscriptions` join | **NOT PRESENT** — billing tables (doc 04) |
| **Created** | `restaurants.created_at` (`schema.sql:27`) | present |
| **Last Activity** | `max(events.occurred_at)` for tenant | derived from `events` (`schema.sql`) |
| **Users** | `count(restaurant_members)` for tenant | present |
| **Actions** | — | row action menu (below) |

### Capabilities

- **Search / filter** — by name, slug, plan, status, activity recency.
- **Open** — navigate to Restaurant Details (read-only operator view).
- **Impersonate** — launch a scoped, audited impersonation session (§7).
- **Disable / Enable** — flip tenant `status`; disabled tenants reject member logins and public menu (proposed `status` column).
- **Delete** — hard delete cascades via existing FKs (`on delete cascade`, `schema.sql:33` etc.); must require confirmation + audit entry; prefer soft-delete (`status='deleted'`).
- **Billing** — jump to the tenant's subscription (doc 04 dependency).
- **Usage** — jump to per-tenant Usage screen.
- **Create** — provision a new tenant (insert `restaurants` + first `owner` membership). Today `restaurant_members` has **no insert RLS policy**, so creation/onboarding already requires service-role — formalize it as a platform-only action with an audit entry.

---

## 7. Impersonation — Security Design

Impersonation lets a `super_admin` act inside a tenant for support. It is the highest-risk capability and must be tightly constrained.

### Rules

1. **Short-lived, signed impersonation token.** Issue a separate, server-signed token (or a Supabase session minted via admin API) carrying `act_as_restaurant_id`, the **real** operator `sub` (`impersonator_id`), and a hard `exp` (e.g. 15–30 min). It is distinct from the operator's normal session and cannot be self-extended by the client.
2. **Mandatory audit-log entry (fail-closed).** Every impersonation **start, action, and end** writes to the platform `audit_logs` table (canonical schema: `05-billing-audit-backups.md` §2.2) with `{impersonator_id, restaurant_id, action, target_id, ip, timestamp}`. No impersonation without a log write; failure to log = deny. This is the **deliberate exception** to the platform's general audit policy: ordinary audit logging is best-effort / fail-open (the `logAudit()` helper swallows write failures — see `05-billing-audit-backups.md` §2.3), but **impersonation start/stop is fail-closed** — if its audit write fails, the impersonation is aborted rather than proceeding unlogged.
3. **Visible banner.** A persistent, non-dismissible UI banner ("You are impersonating **{restaurant.name}** — exit") is shown for the entire session so the operator can never mistake context.
4. **Read-or-scoped-write limits.** Default to **read-only**. Writes, if enabled, are scoped strictly to the impersonated `restaurant_id` (re-derived from the token, never from request input) and re-checked against the existing `.eq('restaurant_id', …)` pattern + RLS. Destructive ops (delete tenant/promotion, ownership transfer) are blocked.
5. **No billing actions while impersonating.** Plan changes, payment-method edits, cancellations, and platform settings are **hard-blocked** during impersonation, regardless of role.
6. **Auto-expire.** Token expiry ends the session automatically; no silent refresh. Re-entry requires a fresh, re-audited start.
7. **Exit clears context.** "Exit impersonation" invalidates the impersonation token, restores the operator's own session, removes the banner, and writes an audit `impersonation_end` entry. No residual tenant context leaks into the next request.

### Proposed shape

```ts
// PROPOSAL — impersonation claims (server-signed, short-lived)
interface ImpersonationToken {
  impersonator_id: string;     // real super_admin auth.uid()
  act_as_restaurant_id: string;
  mode: 'read' | 'scoped_write';
  exp: number;                 // <= now + 30min
  audit_id: string;            // links to the mandatory audit_logs row
}
```

> **`audit_logs` canonical schema lives in `05-billing-audit-backups.md` §2.2** (includes `impersonator_id`, `created_at`). It is **not** redefined here — the impersonation flow above writes the `impersonation.start` / `impersonation.stop` actions into that table, recording the real operator in `impersonator_id` and the impersonated identity in `actor_user_id`. Earlier drafts of this section carried a divergent inline DDL (uuid PK, `occurred_at`, `target_table`); that has been removed so only the canonical schema in 05 §2.2 governs.

> **Why a new table:** the existing `changes` table is a per-tenant **content** change log (`migration 0010`), not a platform security audit trail. It has no concept of an impersonator, IP, or cross-tenant action and must not be repurposed for this.

---

## Appendix — Top finding & dependency summary

- **Top finding:** The database is fully multi-tenant with membership-based RLS (`schema.sql:211-220`), but **runtime auth is NOT PRESENT** (no `middleware.ts`, no login, no role checks) and **all** server access runs under the **service-role key that bypasses RLS** (`server.ts:35-51`). Result: `/admin/*` and every write API are open to anonymous callers, and two promotion mutators are cross-tenant-writable by UUID with no tenant check (`promotions/repository.ts:110,119`). Auth must be added before any second tenant is onboarded.
- **Net dependencies for this design:** new `src/middleware.ts`; new `/login`; new `/platform` namespace + `platform_admins`; switch member ops off service-role onto `createServerSupabase`; and new tables (`audit_logs`, plus subscriptions/plans/billing from doc 04). These are **proposals** — no code is modified by this document.
