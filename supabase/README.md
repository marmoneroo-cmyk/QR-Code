# Supabase Setup

This folder contains the database schema and storage configuration for the cocktail-demo platform.

## One-time setup

1. **Create a Supabase project** at https://supabase.com (free tier is enough).
2. **Open SQL Editor** → **New query**.
3. **Copy + run** `migrations/0001_initial_schema.sql` (tables, RLS, seed Diner restaurant).
4. **Copy + run** `migrations/0002_storage_bucket.sql` (cocktail-assets bucket + RLS).
5. **Settings → API** — copy these 3 values into `.env.local` at the project root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```
6. **Authentication → Providers** → enable Email + (optional) Google.

## Schema overview

- `restaurants` — tenants (the "Diner" row is seeded by 0001)
- `restaurant_members` — links Supabase auth users to restaurants with a role
- `cocktails` — menu items, scoped by `restaurant_id`
- `cocktail_layers` — 3D breakdown layers per cocktail
- `cocktail_labels` — ingredient labels per cocktail
- `events` — engagement tracking (views / hover_layer / share / favorite / order)

## RLS in plain English

- **Published cocktails** are visible to anyone (anonymous diners).
- **Drafts** are only visible to restaurant members.
- **Writes** require the user to be a member of the cocktail's restaurant.
- **Events** can be inserted anonymously (for view tracking), but only members can read aggregated data.

## Re-running migrations

The migrations are idempotent (`if not exists`, `on conflict do nothing`, `drop policy if exists` before each `create policy`). Safe to run again.

## Storage convention

`cocktail-assets/{restaurant_slug}/{cocktail_slug}/{layer_id}.png`

Example: `cocktail-assets/diner/citrus-lime-sour/glass.png`

RLS enforces that only members of `restaurant_slug` can write to that folder.
