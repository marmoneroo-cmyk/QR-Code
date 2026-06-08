# Storage Strategy

How persistence works, and why it's built to swap backends without touching the UI.

## The boundary

The UI never imports `localStorage` or the Supabase client directly. It only
talks to the **`CocktailStore`** interface (`src/lib/store/interface.ts`):

```
getDrafts()      → StoredDraft[]
saveDraft(c)     → StoredDraft
deleteDraft(slug)
publishDraft(slug)
findDraft(slug)  → StoredDraft | null
```

Everything else (`useDrafts`, admin pages, import, bulk breakdown) goes through
this contract.

## Adapters

| Adapter | File | When active |
|---------|------|-------------|
| `LocalStorageAdapter` | `store/local.ts` | default — no Supabase env vars |
| `SupabaseAdapter` | `store/supabase.ts` | when `NEXT_PUBLIC_SUPABASE_URL` is set |

The factory `getStore()` (`store/index.ts`) picks one at runtime and wraps it
in an **instrumentation decorator** (timing, payload size, success/failure,
provider) so every persistence call is observable.

```
UI → useDrafts → getStore() → instrument(adapter) → localStorage | Supabase
```

## Switching to Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/*.sql` in order.
3. Put `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
4. Restart. The factory switches automatically — the UI is byte-for-byte identical.

## Schema shape (Supabase)

Normalized, not denormalized JSON:

```
cocktails (1) ──< cocktail_layers (N)
            └────< cocktail_labels (N)
```

`SupabaseAdapter` reads with a nested select (`*, cocktail_layers(*), cocktail_labels(*)`)
and writes with upsert-parent + delete-then-insert-children.

> **Known limitation (acceptable for now):** child replacement is
> delete-then-insert, which is not transactional and can race under concurrent
> multi-device edits. Future: diff-based updates or a transactional RPC.

## Legacy migration

Drafts saved before the adapter refactor used `draftCreatedAt`/`draftUpdatedAt`.
`LocalStorageAdapter.load()` upgrades these to `createdAt`/`updatedAt` on read,
so no existing draft is lost.

## Image assets

Currently hero/layer images are static files under `/public/cocktail/`.
When Supabase Storage is wired (migration `0002_storage_bucket.sql`), uploads
follow the convention `{restaurant_slug}/{cocktail_slug}/{layer_id}.png` with
RLS restricting writes to restaurant members. **Not yet implemented in code.**
