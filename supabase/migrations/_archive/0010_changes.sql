-- 0010_changes.sql
-- Generic change/audit timeline — the historical record of everything that changed
-- in the restaurant. NOT a Closed-Loop-specific table: future systems reuse it.
-- Auto-captured for in-platform actions (promotions, experience); manual only for
-- external actions (printed menu, Instagram campaign, photo shoot, table placement).
-- Private business data → members-only RLS. Idempotent — safe to re-run.

create table if not exists public.changes (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  change_type   text not null,                 -- e.g. 'promotion_created', 'experience_updated', 'external'
  entity_type   text not null,                 -- 'cocktail' | 'promotion' | 'menu' | 'external'
  entity_id     text,                          -- slug / promotion id / null
  before        jsonb,
  after         jsonb,
  summary       text,                          -- human-readable label for the timeline
  source        text not null default 'auto' check (source in ('auto', 'manual')),
  created_at    timestamptz not null default now()  -- = when the change was applied
);

create index if not exists changes_restaurant_idx on public.changes (restaurant_id, created_at desc);
create index if not exists changes_entity_idx on public.changes (restaurant_id, entity_type, entity_id);

comment on table public.changes is
  'Generic change/audit timeline (auto for in-platform actions, manual for external). Drives Closed Loop attribution and the restaurant history.';

alter table public.changes enable row level security;

drop policy if exists "Members read changes" on public.changes;
create policy "Members read changes"
  on public.changes for select using (
    exists (
      select 1 from public.restaurant_members
      where restaurant_members.restaurant_id = changes.restaurant_id
        and restaurant_members.user_id = auth.uid()
    )
  );

drop policy if exists "Members write changes" on public.changes;
create policy "Members write changes"
  on public.changes for all using (
    exists (
      select 1 from public.restaurant_members
      where restaurant_members.restaurant_id = changes.restaurant_id
        and restaurant_members.user_id = auth.uid()
    )
  );
