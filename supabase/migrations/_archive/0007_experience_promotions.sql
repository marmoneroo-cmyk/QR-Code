-- 0007_experience_promotions.sql
-- Menu Experience Builder + Promotions Engine persistence.
-- Until this runs, the app uses the in-code defaults in src/data/experience.ts.
-- Idempotent — safe to re-run.

-- 1) Per-cocktail experience config (content-module toggles + badges), edited by
--    the Menu Experience Builder. The app falls back to in-code defaults when null.
alter table public.cocktails
  add column if not exists experience_config jsonb;

comment on column public.cocktails.experience_config is
  'ExperienceConfig {modules?, badges?} — owner-configured content toggles & badges with optional schedules.';

-- 2) Promotions (the Promotions Engine). Drives discounts AND promo badges.
create table if not exists public.promotions (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid references public.restaurants(id) on delete cascade not null,
  name              text not null,
  type              text not null check (type in ('percentage', 'fixed')),
  value             numeric(10, 2) not null,
  scope             text not null check (scope in ('item', 'category', 'all')),
  target_slugs      jsonb,      -- string[] when scope = 'item'
  target_categories jsonb,      -- string[] when scope = 'category'
  schedule          jsonb,      -- Schedule { windows: ScheduleWindow[] }; null = always live
  badge_kind        text,       -- BadgeKind to auto-activate (app defaults to 'happy_hour')
  badge_label       jsonb,      -- optional {en,he} label override
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists promotions_restaurant_idx
  on public.promotions (restaurant_id, active);

comment on table public.promotions is
  'Scheduled discounts; each active promotion also drives its badge (single source of truth).';

alter table public.promotions enable row level security;

-- Public can read promotions (they are shown on the public menu).
drop policy if exists "Promotions are viewable by everyone" on public.promotions;
create policy "Promotions are viewable by everyone"
  on public.promotions for select using (true);

-- Members manage only their own restaurant's promotions.
drop policy if exists "Members can write promotions" on public.promotions;
create policy "Members can write promotions"
  on public.promotions for all using (
    exists (
      select 1 from public.restaurant_members
      where restaurant_members.restaurant_id = promotions.restaurant_id
        and restaurant_members.user_id = auth.uid()
    )
  );
