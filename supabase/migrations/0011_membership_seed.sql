-- 0011_membership_seed.sql
-- Epic A+B foundation: guarantee the owner -> diner membership exists so that
-- session-derived tenant resolution works and AUTH_ENFORCED=true is lockout-safe.
--
-- WHY THIS IS REQUIRED: getSessionContext() returns a tenant ONLY when the logged-in
-- user has a restaurant_members row. Verified live: restaurant_members is currently
-- EMPTY (0 rows). Without this seed, flipping AUTH_ENFORCED=true would 401 the owner
-- on every admin API and lock them out of /admin. Apply this BEFORE flipping the flag.
--
-- Additive + idempotent -- safe to re-run. No destructive DDL. Apply via the Supabase
-- SQL editor (supabase-js cannot run DDL), like 0007 / 0008.

-- 1) Seed the owner membership. Resolve 'diner' by slug so this is portable across envs.
--    Role 'owner' (confirmed with the owner). on conflict keeps it idempotent.
insert into public.restaurant_members (restaurant_id, user_id, role)
select r.id, '34dc7f5e-9da9-4772-9a7f-71826938bea1'::uuid, 'owner'
from public.restaurants r
where r.slug = 'diner'
on conflict (restaurant_id, user_id) do update set role = excluded.role;

-- 2) Re-assert RLS is enabled on every business table (no-op if already enabled).
--    This is what the runtime now depends on once admin routes use the user-scoped client.
alter table if exists public.restaurants        enable row level security;
alter table if exists public.restaurant_members enable row level security;
alter table if exists public.cocktails          enable row level security;
alter table if exists public.events             enable row level security;
alter table if exists public.promotions         enable row level security;
alter table if exists public.menu_experience    enable row level security;
alter table if exists public.sales              enable row level security;
alter table if exists public.changes            enable row level security;

-- 3) Re-create the membership-read policy defensively (drop-then-create = idempotent).
--    A user may only see their OWN membership row (matches the 0001 intent). This is the
--    policy getSessionContext() relies on to read the caller's tenant under RLS.
drop policy if exists "Users see their own memberships" on public.restaurant_members;
create policy "Users see their own memberships"
  on public.restaurant_members for select
  using (user_id = auth.uid());

-- NOTE: the per-table member read/write policies already exist (0001/0007/0008/0009/0010)
-- and are NOT altered here. This migration only guarantees the seed + RLS-enabled state the
-- runtime now enforces. If a later verify finds a table whose member policy is missing, add
-- it here behind drop-if-exists/create -- never a permissive using(true).

-- Acceptance: select user_id, role from public.restaurant_members; -> one owner -> diner row.
