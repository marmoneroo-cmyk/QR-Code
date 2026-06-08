-- 0008_menu_experience.sql
-- Per-cocktail experience config keyed by SLUG (the live menu is static in-code,
-- so the cocktails table is empty — config lives here instead of cocktails.experience_config).
-- Edited by the Menu Experience Builder. App falls back to in-code defaults when absent.
-- Idempotent — safe to re-run.

create table if not exists public.menu_experience (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  slug          text not null,
  config        jsonb not null default '{}'::jsonb, -- ExperienceConfig {modules?, badges?}
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, slug)
);

create index if not exists menu_experience_restaurant_idx
  on public.menu_experience (restaurant_id);

comment on table public.menu_experience is
  'Per-slug ExperienceConfig (module toggles + badges) for the static menu, edited by the Experience Builder.';

alter table public.menu_experience enable row level security;

drop policy if exists "Menu experience is viewable by everyone" on public.menu_experience;
create policy "Menu experience is viewable by everyone"
  on public.menu_experience for select using (true);

drop policy if exists "Members can write menu experience" on public.menu_experience;
create policy "Members can write menu experience"
  on public.menu_experience for all using (
    exists (
      select 1 from public.restaurant_members
      where restaurant_members.restaurant_id = menu_experience.restaurant_id
        and restaurant_members.user_id = auth.uid()
    )
  );
