-- Idempotency key on events so a retried / duplicated delivery never double-counts.
--
-- The client mints a UUID (`eventId`) per event; the /api/track route already writes it
-- to events.event_id and upserts ON CONFLICT (event_id) DO NOTHING. This migration adds
-- the column + the unique index that makes that conflict target real. Until it is applied
-- the route degrades to a plain insert (no events lost); the moment it is applied,
-- de-duplication activates automatically — no code change, no redeploy.
--
-- `text` (not `uuid`) so a non-UUID fallback id is still accepted. Multiple historical
-- NULLs are allowed (Postgres treats NULLs as distinct in a unique index); only non-null
-- event_ids are de-duplicated.
--
-- Apply via the Supabase SQL editor (supabase-js cannot run DDL). Safe + additive.

alter table public.events add column if not exists event_id text;
create unique index if not exists events_event_id_uniq on public.events (event_id);

-- Acceptance (Sprint-1 C3): after applying, POST the SAME eventId 3× ⇒ exactly 1 row.
