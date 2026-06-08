# Archived migrations

These numbered migrations (`0001`–`0004`, `0006`–`0010`; there is no `0005`) were the
incremental history of the schema. On **2026-06-07** they were **consolidated into a single
baseline at [`supabase/schema.sql`](../../schema.sql)**.

- They were **all applied** to the live Supabase DB — nothing here is pending.
- Kept for **history / context** (the "why & when" of each change). Safe to read, no need to run.
- **Do not run these** on the existing DB. For a **fresh** database, run `supabase/schema.sql` instead.

## Going forward

`supabase/schema.sql` is the single source of truth. For a new schema change:
1. Edit `schema.sql` (add the column/table/policy in its section), **and**
2. Run only the delta on the live DB via the Supabase SQL Editor.

(If you later adopt the Supabase CLI, move back to numbered migrations under `supabase/migrations/`.)
