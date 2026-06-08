-- ============================================================================
-- Cocktail Demo · 0004 Intelligence Layer (Phase 1: event spine)
-- Run in Supabase SQL Editor after 0001–0003.
-- Safe/additive: existing `events` rows remain valid.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Widen the events table for the full diner-facing taxonomy
-- ---------------------------------------------------------------------------
alter table events add column if not exists event_name    text;
-- Menu is code-defined (src/data/cocktail.ts), so analytics key on the slug, not
-- a DB FK that may not exist. cocktail_id stays best-effort/nullable.
alter table events add column if not exists cocktail_slug text;
alter table events add column if not exists table_id      text;
alter table events add column if not exists device_type   text;
alter table events add column if not exists language      text;
alter table events add column if not exists referrer      text;
alter table events add column if not exists value_num     numeric;
alter table events add column if not exists occurred_at   timestamptz;

-- The old narrow event_type CHECK + NOT NULL block the new taxonomy. Relax them
-- (keep the column for back-compat; new rows populate event_name instead).
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'events' and constraint_name = 'events_event_type_check'
  ) then
    alter table events drop constraint events_event_type_check;
  end if;
end $$;

alter table events alter column event_type drop not null;

-- Helpful indexes for the read models / funnels
create index if not exists idx_events_restaurant_occurred
  on events (restaurant_id, occurred_at desc);
create index if not exists idx_events_slug_name
  on events (cocktail_slug, event_name);
create index if not exists idx_events_session
  on events (session_id);
create index if not exists idx_events_table
  on events (restaurant_id, table_id, occurred_at);
-- BRIN keeps time-range scans cheap once volume grows.
create index if not exists idx_events_occurred_brin
  on events using brin (occurred_at);

-- ---------------------------------------------------------------------------
-- Tighten write access: diners no longer insert with the anon key.
-- All writes go through /api/track using the service-role key (bypasses RLS).
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can insert events" on events;
-- (member SELECT policy from 0001 stays in place)

-- ---------------------------------------------------------------------------
-- Menu-engineering: cost per item (price_ils already exists from 0003)
-- ---------------------------------------------------------------------------
alter table cocktails add column if not exists cost_ils numeric(10, 2);

-- ---------------------------------------------------------------------------
-- Conversion funnel per cocktail (distinct sessions per stage).
-- security_invoker so the querying member's RLS still applies.
-- ---------------------------------------------------------------------------
drop view if exists cocktail_funnel;
create view cocktail_funnel
  with (security_invoker = true)
as
select
  e.restaurant_id,
  e.cocktail_slug,
  count(distinct e.session_id) filter (where e.event_name = 'cocktail_impression') as seen,
  count(distinct e.session_id) filter (where e.event_name = 'cocktail_opened')     as opened,
  count(distinct e.session_id) filter (where e.event_name = 'ingredients_opened')  as ingredients,
  count(distinct e.session_id) filter (where e.event_name in ('360_opened', 'ar_opened')) as breakdown,
  count(distinct e.session_id) filter (where e.event_name = 'call_waiter_clicked') as called,
  count(distinct e.session_id) filter (where e.event_name = 'order_completed')     as ordered
from events e
where e.event_name is not null
  and e.cocktail_slug is not null
group by e.restaurant_id, e.cocktail_slug;
