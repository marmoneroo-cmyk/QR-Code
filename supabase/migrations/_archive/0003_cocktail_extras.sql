-- 0003_cocktail_extras.sql
-- Adds the remaining CocktailConfig fields that the app uses but the
-- initial schema omitted: price, food pairings, and kiosk availability hours.
-- Idempotent — safe to re-run.

alter table public.cocktails
  add column if not exists price_ils      numeric(10, 2),
  add column if not exists pairings       jsonb,         -- Localized[]  (food pairings)
  add column if not exists available_hours jsonb;         -- [startHour, endHour] for kiosk scheduling

comment on column public.cocktails.price_ils is 'Menu price in ILS; UI converts to USD/EUR via static FX.';
comment on column public.cocktails.pairings is 'Array of {en,he} food-pairing suggestions.';
comment on column public.cocktails.available_hours is 'Optional [startHour, endHour] window for kiosk time-of-day filtering.';
