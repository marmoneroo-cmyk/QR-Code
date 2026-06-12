-- Segmentation: promote per-tenant business type to a first-class, queryable column.
--
-- Today restaurant_type is stamped onto every event's metadata via the code map in
-- src/lib/segments.ts, so analytics already capture it. This migration is for when
-- multi-tenant onboarding lands and we want it on the restaurants row + queryable.
-- Additive + nullable ⇒ zero risk to existing data/queries. Apply via the Supabase
-- SQL editor (supabase-js cannot run DDL).

alter table public.restaurants
  add column if not exists restaurant_type text;

-- Seed the existing tenant.
update public.restaurants set restaurant_type = 'restaurant'
  where slug = 'diner' and restaurant_type is null;

-- Optionally constrain to the known set once onboarding writes it:
-- alter table public.restaurants add constraint restaurants_type_chk
--   check (restaurant_type in (
--     'cocktail_bar','restaurant','burger_restaurant','wine_bar','cafe','fast_casual','fine_dining'
--   ));
