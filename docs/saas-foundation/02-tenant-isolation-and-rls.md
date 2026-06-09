# 02 — Tenant Isolation & Database (RLS) Audit

**App:** `cocktail-demo` · **Audience:** Founder + engineers · **Status:** Documentation only — no application code was modified.
**Verified against:** `supabase/schema.sql`, `src/lib/supabase/{server,restaurant}.ts`, `src/lib/promotions/repository.ts`, `src/app/api/track/route.ts`, and the recon findings reproduced in the audit brief. Every current-state claim cites a file + line. Anything not found is marked **NOT PRESENT**.

---

## TL;DR (the one finding that matters)

The database is genuinely multi-tenant: every business table carries `restaurant_id NOT NULL` and **RLS is enabled on all 10 tables** with correct membership-based policies (`schema.sql:211-335`). **But that RLS is dormant at runtime.** Every server data path goes through `createAdminSupabase()`, which uses `SUPABASE_SERVICE_ROLE_KEY` (`server.ts:35-51`) and **bypasses RLS entirely**. There is **no app auth** (no `middleware.ts`, no `auth/` dir, no login — all NOT PRESENT), so `auth.uid()` is always null and the membership policies are never exercised. The good schema protects nothing in production today. The fix is architectural, not schema: route tenant CRUD through an **authenticated (user-JWT) client** so RLS actually runs, and reserve service-role for `/api/track` and platform jobs that pass an explicit, server-derived `restaurant_id`.

---

## 1. Three Table Lists

### 1A. PROTECTED — tenant-scoped **and** RLS-enabled (schema is correct)

All business tables are already in this bucket. "Protected" here means *the schema is correct* — see §4 for why this protection is bypassed at runtime.

| Table | Tenant scope | RLS enabled | Policy model | Citation |
|---|---|---|---|---|
| `restaurants` | self (tenant root) | Yes | public read `true`; update = members | `schema.sql:211, 224, 227` |
| `restaurant_members` | direct `restaurant_id` | Yes | select = `user_id = auth.uid()` only | `schema.sql:33, 212, 233` |
| `cocktails` | direct `restaurant_id NOT NULL` | Yes | public read if `published`; members read+write all | `schema.sql:43, 213, 237, 240, 245` |
| `cocktail_layers` | indirect via `cocktail_id` → cocktails | Yes | visibility + write via cocktail join | `schema.sql:214, 251, 261` |
| `cocktail_labels` | indirect via `cocktail_id` → cocktails | Yes | visibility + write via cocktail join | `schema.sql:215, 271, 281` |
| `events` | direct `restaurant_id NOT NULL` | Yes | members read only; **no insert policy** (writes via service-role) | `schema.sql:108, 216, 291-295` |
| `promotions` | direct `restaurant_id NOT NULL` | Yes | public read `true`; members write | `schema.sql:140, 217, 299, 302` |
| `menu_experience` | direct `restaurant_id NOT NULL` | Yes | public read `true`; members write | `schema.sql:157, 218, 308, 311` |
| `sales` | direct `restaurant_id NOT NULL` | Yes | members read + write only (private revenue) | `schema.sql:167, 219, 317, 322` |
| `changes` | direct `restaurant_id NOT NULL` | Yes | members read + write only (content change log) | `schema.sql:179, 220, 328, 333` |
| `cocktail_funnel` (VIEW) | inherits `events.restaurant_id` | `security_invoker=true` (relies on caller RLS) | n/a — view | `schema.sql:341-353` |
| `cocktail-assets` (STORAGE) | folder path `= restaurants.slug` | Yes (storage.objects policies) | public read; member-scoped insert/update/delete by slug folder | `schema.sql:374-409` |

> **Note on `changes`:** despite the in-schema comment calling it a "private audit trail" (`schema.sql:326`), it is a per-tenant **content** change log, **not** a platform security audit log. See §1B and §5.

### 1B. UNPROTECTED — reachable cross-tenant at runtime (needs an authorization control)

These are **not schema defects** — the rows are tenant-scoped. They are unprotected because the *code path* defeats the schema. Listed here because a SaaS audit must surface them as the real exposure.

| Item | Why unprotected | Citation |
|---|---|---|
| `updatePromotion(id, patch)` | Filters `.eq('id', id)` **only — no `restaurant_id` scope**; runs under service-role. Any guessed promotion UUID is editable cross-tenant. | `promotions/repository.ts:107-114` |
| `deletePromotion(id)` | Filters `.eq('id', id)` **only — no `restaurant_id` scope**; service-role. Cross-tenant delete by UUID. | `promotions/repository.ts:117-121` |
| Child-row deletes (layers/labels) | Deleted by `cocktail_id` only, no tenant check, under service-role. | recon `store/supabase.ts:273-274, 306-307` |
| `/api/track` ingest | Reads `restaurantSlug` straight from POST body, resolves via service-role, inserts events into **any existing tenant**; no auth, no rate limit. | `api/track/route.ts:76, 83, 98` |
| All tenant-write API routes (`promotions`, `sales`, `experience`, `changes` POST/PUT/PATCH/DELETE) | Accept `restaurant` slug from request body/param; no auth; service-role write. | recon `api-routes` (each route carries a `// NOTE (Phase 2): gate behind restaurant-member auth` comment) |
| All analytics GET routes | Default to hardcoded `'diner'` so not steerable today, **but** the lib fns accept `restaurantSlug` and run service-role — one wiring change exposes any tenant. | `analytics/queries.ts:31, 39` |

**Root cause for every row above:** service-role bypass (`server.ts:35-51`) + no auth layer (NOT PRESENT). Fix in §4.

### 1C. NEEDS MIGRATION — add `restaurant_id` / fix scope

**None among existing business tables.** Confirmed explicitly: every business table already has `restaurant_id NOT NULL` with `references restaurants(id) on delete cascade` (`schema.sql:43, 108, 140, 157, 167, 179`), and `cocktail_layers`/`cocktail_labels` are intentionally scoped via `cocktail_id` FK (`schema.sql:73, 89`). RLS is enabled on all 10 (`schema.sql:211-220`). **No existing table needs a tenant-scoping migration.**

What *is* missing is a set of **net-new SaaS platform tables** (none of which exist today):

| Missing table | Status | Citation |
|---|---|---|
| `plans` | **NOT PRESENT** — no table, no migration, no code ref | recon `db-rls` §3 |
| `subscriptions` | **NOT PRESENT** | recon `db-rls` §3 |
| `audit_logs` (platform security audit) | **NOT PRESENT** — `changes` is content-only | recon `db-rls` §3; `schema.sql:326` |
| `platform_admins` / super_admin role | **NOT PRESENT** — `role` is `owner\|manager\|staff` only | `schema.sql:35` |
| `invitations` | **NOT PRESENT** — `restaurant_members` has no insert RLS policy, so onboarding needs service-role | `schema.sql:231-233` |
| `experiments` | **NOT PRESENT** as a table — A/B results are events-derived | recon `db-rls` §3 |

DDL + RLS for the genuinely needed ones (`plans`, `subscriptions`, `audit_logs`, `platform_admins`, `invitations`) is in §5.

---

## 2. Current RLS Status (at a glance)

| Object | RLS on? | SELECT | INSERT | UPDATE | DELETE | Effective enforcement at runtime |
|---|---|---|---|---|---|---|
| `restaurants` | Yes (`:211`) | public `true` (`:224`) | — (service-role only) | members (`:227`) | — | **Bypassed** (service-role) |
| `restaurant_members` | Yes (`:212`) | `user_id=auth.uid()` (`:233`) | — | — | — | Bypassed; **no write policy → invites need service-role** |
| `cocktails` | Yes (`:213`) | published OR members (`:237,240`) | members (`for all` `:245`) | members | members | Bypassed |
| `cocktail_layers` | Yes (`:214`) | via cocktail (`:251`) | via join (`:261`) | via join | via join | Bypassed |
| `cocktail_labels` | Yes (`:215`) | via cocktail (`:271`) | via join (`:281`) | via join | via join | Bypassed |
| `events` | Yes (`:216`) | members (`:293`) | **none** (service-role writes) | none | none | Reads bypassed; **inserts intentionally service-role** |
| `promotions` | Yes (`:217`) | public `true` (`:299`) | members (`:302`) | members | members | Bypassed |
| `menu_experience` | Yes (`:218`) | public `true` (`:308`) | members (`:311`) | members | members | Bypassed |
| `sales` | Yes (`:219`) | members (`:317`) | members (`:322`) | members | members | Bypassed |
| `changes` | Yes (`:220`) | members (`:328`) | members (`:333`) | members | members | Bypassed |
| `cocktail_funnel` (view) | `security_invoker=true` (`:341`) | inherits caller | n/a | n/a | n/a | Bypassed (caller is service-role) |
| `storage.objects` (`cocktail-assets`) | Yes | public bucket (`:379`) | member folder (`:382`) | member folder (`:392`) | member folder (`:402`) | **Unused** — no code calls `storage.from().upload()` (recon `analytics-storage` §2) |

**Legend:** "members" = `exists (select 1 from restaurant_members where restaurant_members.restaurant_id = T.restaurant_id and user_id = auth.uid())`. "Bypassed" = the policy is correct but never enforced because all access uses the service-role client (`server.ts:35-51`).

---

## 3. Missing & Recommended RLS Policies (runnable SQL)

These are **proposals**, not applied changes. They harden the existing tables and add the patterns a real SaaS needs. Run order matters: create the helper (`platform_admins` + `is_platform_admin()`) first, then the policies.

### 3.0 Helper: super_admin bypass via a `platform_admins` table

A super_admin must read/write across *all* tenants without being a `restaurant_member` of each. Two standard patterns:

- **Pattern A — `platform_admins` table (recommended):** explicit allow-list of `auth.users`, checked by a `SECURITY DEFINER` function. Auditable, revocable with a row delete, no JWT minting changes.
- **Pattern B — JWT claim:** stamp `app_metadata.platform_role = 'super_admin'` on the user and read `auth.jwt() -> 'app_metadata' ->> 'platform_role'`. No table, but requires control of token minting and is harder to audit/revoke.

This document uses **Pattern A** everywhere; the JWT variant is shown inline as a comment.

> **Canonical definition lives in `03-auth-roles-superadmin.md` §5.** The shape below mirrors it: `user_id` PK, a `role` tier (`admin`/`support`/`read_only`), an optional `note`, and `created_at`. The `is_platform_admin()` helper below intentionally tests **existence by `user_id` only**, so it stays correct with the added `role` column.

```sql
-- Platform-level super admins (cross-tenant). NOT PRESENT today — proposed.
-- Canonical schema: 03-auth-roles-superadmin.md §5.
create table if not exists platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin','support','read_only')),
  note       text,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

-- Only existing platform admins may see/manage the platform_admins list.
-- (Bootstrap the first row via service-role / SQL editor.)
drop policy if exists "platform admins manage themselves" on platform_admins;
create policy "platform admins manage themselves" on platform_admins
  for all
  using  (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()))
  with check (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()));

-- SECURITY DEFINER so the check itself isn't blocked by platform_admins RLS.
create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins pa where pa.user_id = auth.uid());
  -- JWT variant (Pattern B):
  -- select coalesce(auth.jwt() -> 'app_metadata' ->> 'platform_role', '') = 'super_admin';
$$;

revoke all on function is_platform_admin() from public;
grant execute on function is_platform_admin() to authenticated;
```

### 3.1 Reusable membership helper (DRY)

Every policy repeats the same `exists (... restaurant_members ...)` subquery. Extract it so future tables stay consistent and a super_admin OR-branch is added in one place.

```sql
create or replace function is_member_of(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_platform_admin()
      or exists (
        select 1 from restaurant_members rm
        where rm.restaurant_id = p_restaurant_id
          and rm.user_id = auth.uid()
      );
$$;

revoke all on function is_member_of(uuid) from public;
grant execute on function is_member_of(uuid) to authenticated;
```

> With `is_member_of()`, each existing policy can be rewritten as `using (is_member_of(T.restaurant_id))`. This single change also grants super_admin access to every tenant table without touching each policy. **Optional refactor** — listed for completeness; not required for the core fix.

### 3.2 super_admin bypass on existing tenant tables

Add an additive policy so platform admins can operate cross-tenant (alongside the existing member policies). Example for `sales`; replicate per table:

```sql
drop policy if exists "platform admins access all sales" on sales;
create policy "platform admins access all sales" on sales
  for all
  using  (is_platform_admin())
  with check (is_platform_admin());
-- Repeat for: cocktails, cocktail_layers, cocktail_labels, events,
-- promotions, menu_experience, changes, restaurants, restaurant_members.
```

### 3.3 `events` INSERT policy — only if moving off service-role

Today `events` has **no insert policy** by design; `/api/track` writes via service-role (`schema.sql:289-295`, `api/track/route.ts:98`). If you keep a server-side trusted ingest, **leave this as-is**. Add an insert policy **only** if authenticated clients (or an authenticated edge function) should insert directly:

```sql
-- OPTIONAL: allow members to insert events for their own restaurant.
-- Use ONLY if you stop writing events via the service-role /api/track path.
drop policy if exists "members insert their restaurant events" on events;
create policy "members insert their restaurant events" on events
  for insert
  with check (is_member_of(restaurant_id));
```

> Recommendation: **keep ingest on service-role** (it must accept anonymous diner traffic), but make the *route* derive `restaurant_id` from a trusted source, not a client-supplied slug (see §4). Do **not** open a public insert policy — that was deliberately removed in migration 0004 (`schema.sql:290-291`).

### 3.4 `restaurant_members` INSERT policy — fix the onboarding gap

There is **no insert/update/delete policy** on `restaurant_members` (`schema.sql:231-233`), so adding a member requires service-role today. Allow **owners** to manage members of their own restaurant:

```sql
drop policy if exists "owners manage their members" on restaurant_members;
create policy "owners manage their members" on restaurant_members
  for all
  using (
    is_platform_admin()
    or exists (
      select 1 from restaurant_members owner
      where owner.restaurant_id = restaurant_members.restaurant_id
        and owner.user_id = auth.uid()
        and owner.role = 'owner'
    )
  )
  with check (
    is_platform_admin()
    or exists (
      select 1 from restaurant_members owner
      where owner.restaurant_id = restaurant_members.restaurant_id
        and owner.user_id = auth.uid()
        and owner.role = 'owner'
    )
  );
```

> The existing `"Users see their own memberships"` SELECT policy (`schema.sql:233`) should remain so non-owners can still read their own row. The two policies coexist (PostgreSQL ORs multiple permissive policies per command).

---

## 4. THE SERVICE-ROLE PROBLEM (why good RLS is dormant)

### 4.1 Exactly how the bypass happens

`createAdminSupabase()` builds a Supabase client with the **service-role key**:

```ts
// src/lib/supabase/server.ts:35-51
export function createAdminSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;   // line 37
  ...
  return createServerClient<Database>(url, serviceKey, { cookies: { getAll: () => [], setAll: () => {} } }); // line 45
}
```

The service-role key is a Postgres role (`service_role`) that Supabase grants **`BYPASSRLS`**. When a query runs under it, PostgreSQL skips every `USING`/`WITH CHECK` clause on every table — the policies in `schema.sql:222-335` are simply not evaluated. Additionally this client passes **no cookies** (`server.ts:47-48`), so even if RLS *were* evaluated, `auth.uid()` would be `null` and every member policy would return false.

### 4.2 Why that makes the RLS dormant

- **Every server data module uses this client.** Recon (`data-access` §1) confirms `createAdminSupabase` is called by `analytics/queries.ts`, `changes/repository.ts`, `experience/repository.ts`, `promotions/repository.ts`, `sales/repository.ts`, `closedloop/server.ts`, `restaurant.ts:10`, and `api/track/route.ts`. The RLS-respecting anon client `createServerSupabase` (`server.ts:5`) is **never imported by any route or data module** — it is effectively dead code.
- **No auth means no `auth.uid()`.** There is **no `middleware.ts`, no `auth/` dir, no login** (all NOT PRESENT — recon `auth-ui-session` §1). Real users never authenticate, so the membership subquery `... and user_id = auth.uid()` can never match. The only thing standing between an anonymous caller and any tenant's data is (a) the hardcoded `TENANT_SLUG = 'diner'` default (`analytics/queries.ts:31`) and (b) hand-written `.eq('restaurant_id', …)` filters — **neither is an authorization control.**
- **Net effect:** the multi-tenant schema is real but unenforced. Any path where the tenant slug/`id` becomes attacker-controllable crosses tenants. `/api/track` already does this (`route.ts:76`), and `updatePromotion`/`deletePromotion` are cross-tenant-writable by UUID with no slug needed at all (`promotions/repository.ts:110, 119`).

### 4.3 Remediation

1. **Introduce real auth.** Add Supabase Auth + a `middleware.ts` gate over `/admin/*` and all tenant-write API routes. Until login exists, RLS can never run for users. (Tracked separately in the auth deliverable.)
2. **Use an authenticated (user-JWT) client for all tenant CRUD.** Replace `createAdminSupabase()` in every read/write data module with the cookie-aware, RLS-respecting client (`createServerSupabase`, `server.ts:5`). With a logged-in user, `auth.uid()` is populated and the existing member policies enforce tenant isolation **in the database** — defense in depth that no missing `.eq()` filter can defeat. (After this, the two unscoped promotion mutators become safe automatically, because RLS rejects rows outside the caller's tenant.)
3. **Reserve service-role for two narrow cases only:**
   - `/api/track` ingest, which must accept anonymous diner traffic — but the route must derive `restaurant_id` from a **trusted server source** (e.g. signed menu URL / table token), never from a client-supplied `restaurantSlug` (`route.ts:76`).
   - Platform background jobs (billing reconciliation, audit-log writes, cross-tenant admin) that pass an **explicit, server-computed `restaurant_id`** and never trust client input.
4. **Make the boundary explicit even under service-role.** For any path that legitimately keeps service-role, add `.eq('restaurant_id', …)` to *every* mutator — including `updatePromotion`/`deletePromotion`, which currently scope by `id` alone (`promotions/repository.ts:110, 119`).
5. **Keep RLS as the backstop, not the only line.** Even with the authenticated client, retain explicit tenant filters in queries; RLS is the safety net, app filters are the intent.

---

## 5. New-Table DDL + RLS (proposed)

All cross-tenant `SELECT`/`INSERT`/`UPDATE`/`DELETE` are blocked by the policies below. These tables do **not** exist today (§1C). DDL assumes `is_platform_admin()` and `is_member_of()` from §3 already exist.

### 5.1 `plans` — global catalog (platform-owned, public-readable)

Plans are not tenant-scoped (they are the catalog every tenant chooses from). Public read is fine; only platform admins write.

```sql
create table if not exists plans (
  id             text primary key,                    -- e.g. 'free', 'pro', 'enterprise'
  name           text not null,
  price_cents    integer not null default 0 check (price_cents >= 0),
  currency       text not null default 'usd',
  interval       text not null default 'month' check (interval in ('month', 'year')),
  features       jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table plans enable row level security;

-- SELECT: anyone may read the catalog (needed for a public pricing page).
drop policy if exists "plans are publicly readable" on plans;
create policy "plans are publicly readable" on plans for select using (true);

-- INSERT/UPDATE/DELETE: platform admins only. Tenants can never mutate the catalog.
drop policy if exists "only platform admins write plans" on plans;
create policy "only platform admins write plans" on plans
  for all
  using  (is_platform_admin())
  with check (is_platform_admin());
```

### 5.2 `subscriptions` — tenant-scoped billing state

One active subscription per restaurant. Tenant-scoped via `restaurant_id`; members may **read** their own subscription; only platform admins (billing system) may write — tenants must not self-upgrade by writing rows directly.

```sql
create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  restaurant_id          uuid not null references restaurants(id) on delete cascade,
  plan_id                text not null references plans(id),
  status                 text not null default 'trialing'
                           check (status in ('trialing','active','past_due','canceled','incomplete')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (restaurant_id)            -- one subscription per tenant
);

create index if not exists subscriptions_restaurant_idx on subscriptions (restaurant_id);

alter table subscriptions enable row level security;

-- SELECT: members of THIS restaurant (or platform admin). Blocks reading another tenant's billing.
drop policy if exists "members read their subscription" on subscriptions;
create policy "members read their subscription" on subscriptions
  for select
  using (is_member_of(restaurant_id));

-- INSERT: platform/billing only (service-role or platform admin). Tenants cannot create subscriptions directly.
drop policy if exists "platform writes subscriptions (insert)" on subscriptions;
create policy "platform writes subscriptions (insert)" on subscriptions
  for insert
  with check (is_platform_admin());

-- UPDATE: platform/billing only. with check re-asserts on the NEW row to block tenant_id swaps.
drop policy if exists "platform writes subscriptions (update)" on subscriptions;
create policy "platform writes subscriptions (update)" on subscriptions
  for update
  using  (is_platform_admin())
  with check (is_platform_admin());

-- DELETE: platform/billing only.
drop policy if exists "platform writes subscriptions (delete)" on subscriptions;
create policy "platform writes subscriptions (delete)" on subscriptions
  for delete
  using (is_platform_admin());
```

> **How each cross-tenant op is blocked:** SELECT — `is_member_of(restaurant_id)` is false for a non-member, so other tenants' rows are invisible. INSERT — `with check (is_platform_admin())` rejects any tenant-initiated insert (including one forging another `restaurant_id`). UPDATE — `using` hides rows the caller can't see and `with check` re-validates the post-update row, blocking a tenant from moving its row to another tenant. DELETE — `using (is_platform_admin())` means a tenant cannot delete any subscription, theirs or another's. (Billing writes run as service-role/platform admin, never as a tenant member.)

### 5.3 `audit_logs` — platform security audit (distinct from `changes`)

`changes` is a per-tenant **content** timeline (`schema.sql:326`); this is a **security** audit (logins, role changes, billing events, cross-tenant admin actions). Tenant-scoped where applicable, but `restaurant_id` is nullable for platform-level events. **Append-only:** no UPDATE/DELETE policy for anyone (immutability is the point).

> **Canonical schema lives in `05-billing-audit-backups.md` §2.2** (includes `impersonator_id`, `created_at`). The `create table audit_logs` DDL is **not** repeated here to avoid a second, drifting definition — only the tenant-isolation RLS below is in scope for this doc. The RLS policies reference the canonical columns (`restaurant_id`, `action`, `created_at`).

```sql
-- audit_logs schema: see 05-billing-audit-backups.md §2.2 (canonical).
-- This block is RLS only; it assumes the table already exists per that schema.
alter table audit_logs enable row level security;

-- SELECT: members may read THEIR restaurant's audit rows; platform admins read all.
--         Platform-level rows (restaurant_id is null) are visible to platform admins only.
drop policy if exists "members read their audit logs" on audit_logs;
create policy "members read their audit logs" on audit_logs
  for select
  using (
    is_platform_admin()
    or (restaurant_id is not null and is_member_of(restaurant_id))
  );

-- INSERT: platform/service-role only (the app writes audit rows on behalf of the system).
--         No tenant may forge audit entries.
drop policy if exists "platform inserts audit logs" on audit_logs;
create policy "platform inserts audit logs" on audit_logs
  for insert
  with check (is_platform_admin());

-- NO update policy and NO delete policy => append-only for everyone
-- (service-role can still bypass for retention jobs; that is intentional and should be rare/logged).
```

> **Cross-tenant guarantees:** SELECT is gated by membership/admin and explicitly hides null-`restaurant_id` platform rows from tenants. There is **no** UPDATE or DELETE policy, so under RLS *nobody* can tamper with or erase audit history — exactly what a security log requires. INSERT is admin/platform-only so tenants can't fabricate entries.

### 5.4 `platform_admins` — already defined in §3.0

See §3.0 for DDL + the self-managing RLS policy and `is_platform_admin()`. Restated as the canonical super_admin mechanism: an explicit allow-list of `auth.users`, checked by a `SECURITY DEFINER` function, used as the cross-tenant bypass branch in every policy above.

### 5.5 `invitations` — onboard members without service-role

Closes the gap that `restaurant_members` has no insert policy (`schema.sql:231-233`). An owner invites by email; the invitee accepts to become a member. Tenant-scoped via `restaurant_id`.

```sql
create table if not exists invitations (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  email         text not null,
  role          text not null default 'staff' check (role in ('owner','manager','staff')),
  token         text not null unique,            -- random; emailed to invitee
  invited_by    uuid references auth.users(id) on delete set null,
  status        text not null default 'pending'
                  check (status in ('pending','accepted','revoked','expired')),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now(),
  unique (restaurant_id, email)
);

create index if not exists invitations_restaurant_idx on invitations (restaurant_id, status);

alter table invitations enable row level security;

-- SELECT: owners/managers of THIS restaurant (or platform admin) see its invitations.
drop policy if exists "managers read invitations" on invitations;
create policy "managers read invitations" on invitations
  for select
  using (
    is_platform_admin()
    or exists (
      select 1 from restaurant_members rm
      where rm.restaurant_id = invitations.restaurant_id
        and rm.user_id = auth.uid()
        and rm.role in ('owner','manager')
    )
  );

-- INSERT: only owners/managers of THIS restaurant may create invitations.
--         with check binds the new row's restaurant_id to a tenant the caller manages,
--         blocking an attacker from inviting themselves into ANOTHER tenant.
drop policy if exists "managers create invitations" on invitations;
create policy "managers create invitations" on invitations
  for insert
  with check (
    is_platform_admin()
    or exists (
      select 1 from restaurant_members rm
      where rm.restaurant_id = invitations.restaurant_id
        and rm.user_id = auth.uid()
        and rm.role in ('owner','manager')
    )
  );

-- UPDATE (revoke / re-issue): owners/managers of THIS restaurant. with check re-asserts scope.
drop policy if exists "managers update invitations" on invitations;
create policy "managers update invitations" on invitations
  for update
  using (
    is_platform_admin()
    or exists (
      select 1 from restaurant_members rm
      where rm.restaurant_id = invitations.restaurant_id
        and rm.user_id = auth.uid() and rm.role in ('owner','manager')
    )
  )
  with check (
    is_platform_admin()
    or exists (
      select 1 from restaurant_members rm
      where rm.restaurant_id = invitations.restaurant_id
        and rm.user_id = auth.uid() and rm.role in ('owner','manager')
    )
  );

-- DELETE: owners/managers of THIS restaurant only.
drop policy if exists "managers delete invitations" on invitations;
create policy "managers delete invitations" on invitations
  for delete
  using (
    is_platform_admin()
    or exists (
      select 1 from restaurant_members rm
      where rm.restaurant_id = invitations.restaurant_id
        and rm.user_id = auth.uid() and rm.role in ('owner','manager')
    )
  );
```

> **Acceptance flow note:** accepting an invitation (token → new `restaurant_members` row) should run in a `SECURITY DEFINER` function that validates the token, checks `expires_at`/`status`, inserts the membership, and flips the invitation to `accepted` — so the invitee never needs direct write access to `restaurant_members`. That function is the only sanctioned path to create a membership besides §3.4's owner policy.

---

## 6. Implementation Order (proposed, not applied)

1. **Auth first** — Supabase Auth + `middleware.ts` gate (prerequisite; without it RLS can never run).
2. **Swap clients** — replace `createAdminSupabase()` with the authenticated client in all tenant CRUD modules (§4.3.2). This alone neutralizes the §1B exposures.
3. **Harden the two unscoped mutators** — add `.eq('restaurant_id', …)` to `updatePromotion`/`deletePromotion` as belt-and-suspenders (`promotions/repository.ts:107-121`).
4. **Add the helpers** — `platform_admins`, `is_platform_admin()`, `is_member_of()` (§3.0–3.1); bootstrap the first super_admin via SQL editor.
5. **Add platform tables** — `plans`, `subscriptions`, `audit_logs`, `invitations` with the RLS above (§5).
6. **Lock the ingest** — make `/api/track` derive `restaurant_id` from a trusted token, not the client body (`route.ts:76`); keep it on service-role.

---

### Appendix — Files cited

| File | What it proves |
|---|---|
| `supabase/schema.sql:211-335` | RLS enabled + membership policies on all 10 tables |
| `supabase/schema.sql:341-353` | `cocktail_funnel` view, `security_invoker=true` |
| `supabase/schema.sql:374-409` | storage bucket policies (member-scoped writes) |
| `supabase/schema.sql:33, 35` | `restaurant_members` FK + `role` constrained to `owner\|manager\|staff` |
| `src/lib/supabase/server.ts:35-51` | service-role client (BYPASSRLS), no cookies |
| `src/lib/supabase/server.ts:5-33` | anon RLS-respecting client (never used by routes/modules) |
| `src/lib/supabase/restaurant.ts:7-15` | slug→UUID resolution via service-role |
| `src/lib/promotions/repository.ts:107-121` | `updatePromotion`/`deletePromotion` scoped by `id` only — cross-tenant write |
| `src/app/api/track/route.ts:76, 98` | client-supplied `restaurantSlug`, service-role insert, no auth |
