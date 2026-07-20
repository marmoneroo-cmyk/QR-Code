# Connect Claude to Supabase for SQL (the safe path)

This is the durable way to let Claude run SQL — apply migrations, inspect policies,
verify RLS — **without ever handing Claude a raw secret in chat.** The token lives in
your shell environment; the MCP server reads it; Claude only calls the server's tools.

> The one absolute rule (already in `.env.example`): a real connection string,
> service-role key, DB password, or access token **must never be pasted into chat,
> a commit, or an issue.** This flow is built specifically so that never has to happen.

## Why this and not a connection string

- Claude is not permitted to accept a connection string / DB password / service-role
  key in chat — handling secrets in plaintext is a prohibited action.
- The official `@supabase/mcp-server-supabase` MCP server authenticates with a
  **Personal Access Token (PAT)** that stays in *your* environment. Claude invokes the
  server's typed tools (`list_tables`, `execute_sql`, `apply_migration`, …) and never
  sees the token value.

## One-time setup

1. **Create a scoped PAT** — Supabase Dashboard → Account → **Access Tokens** →
   *Generate new token*. Name it e.g. `claude-mcp`. Copy it once (you won't see it again).

2. **Put the token in your environment — not in any file that gets committed.**
   PowerShell (current shell only):
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = "<the-PAT-you-just-copied>"
   $env:SUPABASE_PROJECT_REF  = "<your-project-ref>"   # the sub-domain of your *.supabase.co URL; not a secret
   ```
   (For a persistent setup, add both to a **gitignored** local env file your shell
   loads — never `.env.example`, never a tracked file.)

3. **Activate the MCP config** — copy the template to the real filename:
   ```powershell
   Copy-Item .mcp.json.example .mcp.json
   ```
   `.mcp.json` references `${SUPABASE_ACCESS_TOKEN}` / `${SUPABASE_PROJECT_REF}` — it
   contains **no secret**, so it's safe even if committed. (It's gitignored anyway.)

4. **Restart Claude Code** so it picks up the new MCP server, and approve it when prompted.

## Read-only by default, elevate deliberately

The template runs the server with **write access** so it can apply migration `0013`.
For everyday analytics/inspection where Claude should never mutate the DB, add
`--read-only` to the `args` array in `.mcp.json`:

```jsonc
"args": ["-y", "@supabase/mcp-server-supabase@latest", "--read-only", "--project-ref=${SUPABASE_PROJECT_REF}"]
```

Recommended posture: keep `--read-only` on; remove it only for the brief window when you
want Claude to apply a migration, then put it back. The PAT is account-level, so treat it
as sensitive and **revoke it** in the dashboard when you no longer need Claude to have DB
access.

## First job once connected

Apply and verify the dormant RLS perf migration:

- Apply: `supabase/migrations/0013_rls_initplan_optimization.sql`
  (non-destructive, idempotent, and dormant while the server still uses the service-role
  client — it changes nothing at runtime today).
- Verify every policy got optimized:
  ```sql
  select tablename, policyname,
         (qual ilike '%select auth.uid%' or with_check ilike '%select auth.uid%') as optimized
  from pg_policies
  where schemaname = 'public'
    and (qual ilike '%auth.uid%' or with_check ilike '%auth.uid%')
  order by tablename, policyname;
  ```
  Every row should read `optimized = true`.
