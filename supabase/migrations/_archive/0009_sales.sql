-- 0009_sales.sql
-- Read-only sales ingestion: actual units/revenue per cocktail over a period,
-- imported from the POS (CSV). This is the conversion DENOMINATOR that turns
-- "Conversion Leak / Lost Revenue / Price Sensitivity" from directional into proven.
-- We only READ what sold — we never place orders.
-- Sales are PRIVATE business data → members-only RLS (no public read).
-- Idempotent — safe to re-run.

create table if not exists public.sales (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  slug          text not null,
  units         integer not null default 0,
  revenue       numeric(12, 2) not null default 0,
  period_start  date not null,
  period_end    date not null,
  created_at    timestamptz not null default now()
);

create index if not exists sales_restaurant_idx on public.sales (restaurant_id, slug);

comment on table public.sales is
  'Actual POS sales per cocktail per period (read-only ingestion). The conversion denominator for optimization.';

alter table public.sales enable row level security;

-- Members only — sales are private revenue data (NOT public like promotions).
drop policy if exists "Members read sales" on public.sales;
create policy "Members read sales"
  on public.sales for select using (
    exists (
      select 1 from public.restaurant_members
      where restaurant_members.restaurant_id = sales.restaurant_id
        and restaurant_members.user_id = auth.uid()
    )
  );

drop policy if exists "Members write sales" on public.sales;
create policy "Members write sales"
  on public.sales for all using (
    exists (
      select 1 from public.restaurant_members
      where restaurant_members.restaurant_id = sales.restaurant_id
        and restaurant_members.user_id = auth.uid()
    )
  );
