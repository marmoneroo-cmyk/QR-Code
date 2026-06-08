# Data Flow

How a cocktail draft moves through the system, from creation to display.

## Creating / editing a draft

```
/admin/new  or  /admin/[slug]/edit
        │
        ▼
  CocktailForm  ──(generate hero image, optional 3D breakdown)──┐
        │                                                        │
        │  handleSave()                                          ▼
        │                                              /api/generate-breakdown
        ▼                                              (streams NDJSON layers)
  useDrafts.upsert(cocktail)   ◄───────────────────────────────┘
        │
        ▼
  getStore().saveDraft(cocktail)        ← instrumented: ms, bytes, ok/fail
        │
        ├─ localStorage:  read → merge → write  (key: cocktail-demo:drafts)
        └─ Supabase:      upsert cocktails → replace layers/labels
```

`upsert` is **async** (returns a Promise). Callers that need the save to
complete before navigating (`CocktailForm`, bulk import, bulk breakdown)
`await` it. Loop callers `await` per item to serialize localStorage writes.

## Reading drafts

```
useDrafts (mount)
   │
   ▼
getStore().getDrafts()   ← instrumented
   │
   ▼
drafts[]  +  hydrated flag
   │
   ├─ /admin            → draft cards (edit / delete / publish / export)
   ├─ / (home)          → merged with MENU into the grid
   └─ /drafts/[slug]    → CocktailScene preview
```

`findBySlug` is synchronous — it reads from the in-memory `drafts[]` already
loaded by the hook, so it stays fast for render paths.

## Display

Published cocktails live in `src/data/cocktail.ts` (`MENU`). Drafts come from
the store. The home page merges them; `/cocktails/[slug]` resolves published
items, `/drafts/[slug]` resolves drafts. Both render the same `CocktailScene`.

## Observability

Every store call is logged via `src/lib/logger.ts` with a `scope: 'store'`
context: `store initialized {provider}`, `saveDraft ok {slug, ms, bytes}`,
`getDrafts failed {ms, error}`, etc. In production these are single-line JSON,
ready to pipe to an aggregator.

## Error handling

- Write failures in `SupabaseAdapter` retry on transient (network/5xx) errors
  via `withRetry`; logical errors (RLS, constraints) surface immediately.
- `CocktailScene`'s 3D canvas is wrapped in `<ErrorBoundary>` — a WebGL crash
  falls back to the static hero image instead of a blank screen.
