# 01 — SaaS Foundation: Roadmap, Risk & Migration Plan

**Multi-Tenant SaaS Foundation Audit · cocktail-demo**
Audience: founder + engineers · Status: **DOCUMENTATION / PLAN ONLY — no application code changed by this document.**
Date: 2026-06-09 · Synthesizes docs 02–06 + the recon bundle.

> **Integrity rule.** Every *current-state* claim cites a real file (`path:line`). Anything absent is marked **NOT PRESENT** with no invention. This document is the top-level plan; the detailed designs live in `02-tenant-isolation-and-rls.md`, `03-auth-roles-superadmin.md`, `04-onboarding-urls-storage.md`, `05-billing-audit-backups.md`, `06-pentest-session-analytics.md`.

---

## 0. The one paragraph that matters

The database is **already a correct multi-tenant design**: every business table carries `restaurant_id NOT NULL` with FK→`restaurants` and `ON DELETE CASCADE`, RLS is enabled on all 10 tables, and policies are membership-based (`supabase/schema.sql:211-335`). **None of it is enforced at runtime.** Every server data path uses the service-role key, which **bypasses RLS** (`src/lib/supabase/server.ts:35-51`), and there is **no application auth at all** — **NOT PRESENT: no `middleware.ts`, no `src/lib/auth/**`, no login route, no `src/app/admin/layout.tsx`** (confirmed across the recon bundle and docs 02–06). The only thing between an anonymous internet user and full cross-tenant read/write is (a) a hardcoded `TENANT_SLUG = 'diner'` default (`src/lib/analytics/queries.ts:31`) and (b) hand-written `.eq('restaurant_id', …)` filters — neither is an authorization control. Two promotion mutators don't even filter by tenant (`src/lib/promotions/repository.ts:110,119`), so any guessed UUID is cross-tenant editable/deletable today, no login required. **On top of that, three Supabase secrets were leaked in chat** (DB password, `service_role` JWT, `sb_secret`). Because `service_role` bypasses RLS, the leak is a full-database compromise until rotated. **Phase 0 (rotate secrets + add auth + stop service-role tenant CRUD) is the highest priority and blocks onboarding any second tenant.**

---

## 1. Prioritized Phased Roadmap

Effort key: **S** ≈ ≤2 days · **M** ≈ 3–10 days · **L** ≈ 2–4+ weeks. Phases are ordered by dependency; **Phase 0 is non-negotiably first.**

### Phase 0 — STOP THE BLEEDING (security) · **HIGHEST PRIORITY**

**Goal:** Close the live, unauthenticated cross-tenant breach and the leaked-credential exposure. Make the existing RLS actually enforce. Nothing else ships until this is done.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 0.1 | **Rotate the three leaked secrets NOW** per `docs/SECURITY-rotate-secrets.md`: reset DB password; rotate the Supabase **JWT secret** (invalidates the leaked `anon` + `service_role` at once); revoke + recreate the `sb_secret`. Update `.env.local` + Vercel (Prod + Preview) and redeploy. | S | — |
| 0.2 | Verify no secret remains in git history / chat / commits: `git grep -nE "service_role\|sb_secret\|eyJ[A-Za-z0-9_-]{20,}" -- . ':!*.md'` returns empty (per rotate guide §6). | S | 0.1 |
| 0.3 | **Add Supabase Auth + `src/middleware.ts`** (NOT PRESENT today) gating `/admin/*` and all mutating `/api/*`; build a `/login` route + `admin/layout.tsx` server gate that 302s anonymous users. (`03-auth…` §2.3; `06-…` §2.) | L | 0.1 |
| 0.4 | **Switch tenant CRUD off service-role.** Replace `createAdminSupabase()` with the RLS-respecting `createServerSupabase()` (`src/lib/supabase/server.ts:5`, currently dead code) in every tenant read/write module (analytics, promotions, sales, experience, changes repos). RLS becomes a real backstop. (`02-…` §4.3.) | M | 0.3 |
| 0.5 | **Fix the two unscoped mutators.** Add `.eq('restaurant_id', restId)` to `updatePromotion`/`deletePromotion` (`src/lib/promotions/repository.ts:110,119`) and the `cocktail_id`-only child deletes (`store/supabase.ts:273-274,306-307`) — belt-and-suspenders behind RLS. | S | 0.4 |
| 0.6 | **Stop trusting tenant from request input.** All member-scoped routes derive `restaurant_id` from the **session**, not body/param `restaurant ?? 'diner'` (`sales/route.ts:13,30`; `promotions/route.ts`; `experience/route.ts:15,27`; `changes/route.ts:13,32`; `track/route.ts:76`). Reject or ignore client-supplied tenant. | M | 0.3 |
| 0.7 | **Harden the always-public ingest.** `/api/track` stays service-role (sole `events` writer by design — no public insert policy, `schema.sql:291`), but bind the tenant to a **signed QR/menu token** instead of free body `restaurantSlug`; add per-IP/per-session rate limiting; alert on unknown-slug volume (`06-…` §3.1, V8/V10). | M | 0.1 |
| 0.8 | **Patch the SSRF + FS-write routes.** `scrape-restaurant` (`route.ts:19,24`): https-only allowlist + block private/link-local/loopback before fetch. `generate-breakdown` (`route.ts:61,109`): `slugify` + `^[a-z0-9-]+$` validate `body.slug` to kill `../` traversal; auth-gate both image routes; cap bytes/time (`06-…` V7/V9). | M | 0.3 |

**Exit criteria (all must hold):**
- All three leaked secrets rotated; old ones provably invalid; `git grep` for secrets is empty.
- No `/admin/*` page and no mutating `/api/*` route is reachable without a valid Supabase session (verified by unauthenticated `curl` → 302/401/403).
- No tenant-scoped read/write uses `createAdminSupabase()` except the two sanctioned system paths (`/api/track` ingest, slug→id resolution).
- `updatePromotion`/`deletePromotion` and child deletes filter by `restaurant_id`; cross-tenant promotion delete-by-UUID no longer possible.
- A two-tenant contract test proves a session for tenant A cannot read or write tenant B via any route.

### Phase 1 — Roles, Permissions & Server Tenant-Context

**Goal:** Turn the persisted-but-unread `restaurant_members.role` into real authorization, and make per-request tenant resolution the single source of truth.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 1.1 | Implement the **permission matrix** (`owner > manager > staff`, deny-by-default; `staff` cannot see `sales`/raw events; billing owner-only) in both API handlers and RLS `WITH CHECK` (`03-…` §3–4; `06-…` V6). | M | Phase 0 |
| 1.2 | **Single tenant-resolution choke point.** Replace the ~12 duplicated `'diner'` literals (`queries.ts:31`, `crm.ts:5`, `journeys.ts:6`, `signals.ts:7`, `tables.ts:6`, `heatmap.ts:22`, `menu-signals.ts:41`, `store/index.ts:21`, `store/supabase.ts:31`, `tracking/queue.ts:17`, `closedloop/server.ts:63`, `track/route.ts:76`) with one resolver returning the **session** tenant (`06-…` §3.3). | M | Phase 0 |
| 1.3 | **Make `restaurant_id` non-optional** in every query signature — remove default params (`queries.ts:39,137,291,337,408`) so a missing tenant is a compile error, not a silent `'diner'` fallback. | S | 1.2 |
| 1.4 | Add the **`is_member_of()` / `is_platform_admin()`** SQL helpers and refactor policies to use them (DRY; one place to add the super-admin OR-branch) (`02-…` §3.0–3.1). | S | Phase 0 |
| 1.5 | Add the **`restaurant_members` owner-manage and `invitations`** RLS so member onboarding no longer requires service-role (`02-…` §3.4, §5.5). | M | 1.4 |

**Exit criteria:** A `staff` session is denied `sales`/raw-events and all destructive ops; `manager` cannot manage owners; no module embeds a literal slug; every analytics fn requires an explicit tenant; per-query contract tests pass for two tenants × three roles.

### Phase 2 — Super Admin Area + Secure Impersonation + Audit Logs

**Goal:** Give the operator a separate, audited cross-tenant console without giving any tenant role cross-tenant power.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 2.1 | Add **`platform_admins`** table + `is_platform_admin()` and the additive cross-tenant RLS branch on every tenant table (`02-…` §3.0, §3.2; `03-…` §5). Bootstrap first admin via SQL editor. | S | Phase 1 |
| 2.2 | Build the **`/platform` namespace** (distinct from `/admin/*`), middleware-gated on `is_super_admin`; Restaurants List + Details + Usage screens (`03-…` §5–6). | L | 2.1 |
| 2.3 | Add the **append-only `audit_logs`** table (actor/IP/UA, nullable `restaurant_id`, no UPDATE/DELETE policy, immutability trigger) + `logAudit()` helper (`05-…` Part 2; `03-…` §7). | M | 2.1 |
| 2.4 | Implement **secure impersonation**: short-lived server-signed token carrying `impersonator_id` + `act_as_restaurant_id`, mandatory audit entry on start/action/end, non-dismissible banner, read-default / scoped-write, no billing actions, auto-expire (`03-…` §7). | L | 2.2, 2.3 |

**Exit criteria:** `/platform/*` is reachable only by a `platform_admins` member; no tenant role can read another tenant; every impersonation start/stop and every privileged action writes an immutable `audit_logs` row; impersonation cannot touch billing or exceed the single target tenant.

### Phase 3 — Onboarding + URL Strategy

**Goal:** Let a new restaurant be provisioned through the product (atomically), and resolve tenant from the URL without breaking diner.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 3.1 | **`provision_restaurant()`** `SECURITY DEFINER` Postgres fn (idempotent by slug): inserts `restaurants` + owner `restaurant_members` + default `menu_experience`; optional demo seed (`04-…` §1.3). | M | Phase 1 |
| 3.2 | **`POST /api/admin/provision`** thin orchestrator (super-admin gated): Supabase Auth owner invite (`inviteUserByEmail`) → RPC → storage scaffold → cache warm (`04-…` §1.3–1.5). | M | 3.1, Phase 2 |
| 3.3 | **URL strategy A:** `platform.com/r/{slug}` via middleware/`[slug]` segment; tenant chosen by path but **authorized by membership**, never by slug alone. Keep legacy flat routes as permanent default-`diner` aliases so existing QR codes never break (`04-…` §2.3). | M | Phase 1 |
| 3.4 | (Later, additive) Subdomain `{slug}.platform.com` (wildcard cert + Host parsing) → custom domains via `tenant_domains` (`04-…` §2.3, options B/C). | L | 3.3 |

**Exit criteria:** A new tenant is provisioned end-to-end (owner invited, dashboards non-empty) atomically and idempotently by slug; every existing diner link and printed QR still resolves byte-for-byte; tenant is resolved per-request and authorized by membership.

### Phase 4 — Billing + Stripe + Feature Gating

**Goal:** Charge money and gate capability server-side.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 4.1 | Add **`plans`** (public-read catalog) + **`subscriptions`** (one per tenant, tenant-read / platform-write RLS) (`02-…` §5.1–5.2; `05-…` §1.2). | M | Phase 2 |
| 4.2 | **Entitlement resolver** `getEntitlement(restaurantId)` (plan→capabilities+limits, process-cached) (`05-…` §1.4). Backfill diner as `enterprise/active`; ship resolver returning `enterprise` for all initially (no behavior change). | M | 4.1 |
| 4.3 | **Stripe** Checkout + Customer Portal + signature-verified `/api/webhooks/stripe` (raw body, idempotent by `event.id`, service-role writes `subscriptions`) (`05-…` §1.3). Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`. | L | 4.1 |
| 4.4 | **Server-side feature gates** on every privileged route: `!isEntitled` → 402, missing capability → 403 (where the `// NOTE (Phase 2): gate…` comments are). Meter AI routes + events per month (`05-…` §1.4, §1.6). | M | 4.2 |

**Exit criteria:** A tenant can self-serve checkout/portal; entitlement is decided server-side from the DB on every privileged request; UI gates are cosmetic only; a direct API call from a non-entitled tenant is rejected (402/403); AI/event usage is metered and capped per tenant.

### Phase 5 — Backups + Per-Restaurant Export + Soft-Delete

**Goal:** Survive data loss and make single-tenant recovery possible without rewinding everyone.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 5.1 | **Soft-delete:** add `restaurants.deleted_at`; turn tenant delete into `set deleted_at = now()`; make `getRestaurantId` resolve soft-deleted slugs to `null` and add `deleted_at is null` to public/menu RLS (`05-…` §3.4). Highest-leverage data-safety fix — today hard `ON DELETE CASCADE` makes tenant delete irreversible (`schema.sql:33,43,108`). | M | Phase 2 |
| 5.2 | **Per-tenant export** `POST /api/admin/restaurants/[slug]/export` → single Zod-validated `restaurant-export-v1` JSON bundle + asset manifest; **restore/import** with `new`/`overwrite` modes; audit every export (`05-…` §3.2–3.3). | L | Phase 2 |
| 5.3 | **Backups/PITR:** enable Supabase PITR (≥7d → 30d before paying tenants); document project ref + restore runbook in ops (not repo); quarterly restore drills (`05-…` §3.1, §3.6). | S | — |
| 5.4 | **Retention jobs:** partition + age `events` (13mo) and `audit_logs` (24mo) via `drop partition`; 30-day soft-delete purge window (`05-…` §3.5). | M | 5.1, 2.3 |
| 5.5 | **Per-tenant private storage:** add `cocktail-private` bucket (signed URLs) for imports/exports; start actually using `cocktail-assets/{slug}/…` (no `storage.from().upload()` exists today) (`04-…` §3). | M | Phase 3 |

**Exit criteria:** Deleting a tenant is reversible within 30 days and stops serving its menu immediately; a single tenant can be exported and restored without touching other tenants; PITR is enabled and a restore drill has succeeded; private exports are never world-readable.

---

## 2. Risk Assessment Matrix

Severity = Likelihood × Impact, using the project scale (Critical = data loss / cross-tenant compromise). Likelihood/Impact: H/M/L.

| Risk | Likelihood | Impact | Severity | Mitigation (phase) |
|---|---|---|---|---|
| **Leaked Supabase secrets** (DB pw, `service_role` JWT, `sb_secret`) — `service_role` bypasses RLS = full-DB read/write to anyone who saw chat | **High** (already exposed) | **Critical** | **Critical** | Rotate all three immediately + redeploy + git-grep verify (**0.1–0.2**) |
| **Cross-tenant write/delete via raw UUID** — `updatePromotion`/`deletePromotion` filter `id` only (`promotions/repository.ts:110,119`), no auth, service-role | **High** (no creds needed) | **Critical** | **Critical** | Add `restaurant_id` filter + auth + RLS client (**0.4–0.5**) |
| **Cross-tenant leakage via body/param slug** — sales/promotions/experience/changes/track take `restaurant ?? 'diner'` from the request | **High** | **Critical** | **Critical** | Derive tenant from session; ignore client tenant (**0.3, 0.6**) |
| **Open `/admin/*` + service-role console** — no gate; linked from public menu (`SettingsToolbar.tsx:~209`) | **High** | **Critical** | **Critical** | Middleware + login + admin layout gate (**0.3**) |
| **RLS dormant** — anon RLS client is dead code (`server.ts:5`); `auth.uid()` always null | **High** | **Critical** | **Critical** | Route tenant CRUD through RLS client (**0.4**) |
| **Unauthenticated revenue/PII read** — `GET /api/sales?restaurant=`, raw events/sessions leak `session_id`/`table_id`/`metadata` | **High** | **High** | **High** | Session-gate reads; no `?restaurant=` (**0.3, 0.6**) |
| **Privilege escalation** — `restaurant_members.role` never read; no `super_admin`; every member would be omnipotent once auth lands | **Medium** (post-auth) | **High** | **High** | Permission matrix in RLS + handlers; separate platform-admin mechanism (**1.1, 2.1**) |
| **SSRF** — `scrape-restaurant` fetches arbitrary user `url` (metadata endpoints reachable) | **Medium** | **High** | **High** | Allowlist + private-IP block + auth (**0.8**) |
| **Analytics pollution / tenant spoofing** — `/api/track` trusts body slug, no rate limit, silent unknown-slug success | **High** | **Medium** | **High** | Signed token tenant binding + rate limit + alerting (**0.7**) |
| **Path traversal / FS abuse** — `generate-breakdown` builds filename from unsanitized `body.slug` | **Medium** | **Medium** | **Medium** | Slugify + regex validate + auth + caps (**0.8**) |
| **Billing bypass** — no plan/subscription/entitlement layer; once added, client-side-only gating is trivially bypassed | **Medium** (future) | **High** | **High** | Server-side entitlement on every privileged route; webhook is sole `subscriptions` writer (**4.1–4.4**) |
| **Irreversible data loss** — hard `ON DELETE CASCADE`; deleting a `restaurants` row wipes all children; PITR is whole-project only | **Medium** | **Critical** | **High** | Soft-delete + per-tenant export/restore + PITR + drills (**5.1–5.3, 5.5**) |
| **No forensic trail** — `changes` is a content log (no actor/IP/UA); login/role/billing/impersonation unrecorded | **Medium** | **High** | **High** | Append-only `audit_logs` + `logAudit()` (**2.3**) |
| **Storage cross-tenant enumeration (latent)** — `cocktail-assets` public-read; flat `public/cocktail/*` predictable names | **Low** (bucket unused) | **Medium** | **Low** | Private bucket + signed URLs + randomized keys (**5.5**) |
| **Tenant-existence enumeration** — `/api/track` silently 200s unknown slugs | **Low** | **Low** | **Low** | Uniform responses + rate limit (**0.7**) |

---

## 3. Migration Plan

### 3.1 Current migration state (grounded)

The live `supabase/migrations/` directory contains only `_archive/` + `README.md`; the actual numbered migrations are **archived** as `_archive/0001…0010` (**no 0005** — gap is real, not a missing file). `supabase/schema.sql` is the authoritative consolidated schema. **New migrations should begin at the next free number outside the archive (e.g. `0011_…`+)** and be applied in order. No business table needs a tenant-scoping or backfill migration — every business table already has `restaurant_id NOT NULL` (`schema.sql:43,108,140,157,167,179`); `cocktail_layers`/`cocktail_labels` are scoped via `cocktail_id` FK (`:73,:89`). **The only backfill is seed-tenant continuity (diner), not schema.**

### 3.2 Ordered DB migrations

Run strictly in this order; each is additive and reversible.

| Order | Migration | Contents | Rollback |
|---|---|---|---|
| **M1** | `0011_helpers_platform_admins` | `platform_admins` table + self-managing RLS; `is_platform_admin()`, `is_member_of()` `SECURITY DEFINER` fns (`02-…` §3.0–3.1). Bootstrap first admin via SQL editor. | `drop function` + `drop table` (no tenant data touched). |
| **M2** | `0012_superadmin_policies` | Additive `using/with check (is_platform_admin())` policy on every tenant table (`02-…` §3.2). | Drop the added policies; existing member policies untouched. |
| **M3** | `0013_member_invites` | `restaurant_members` owner-manage policy + `invitations` table & RLS + token-accept `SECURITY DEFINER` fn (`02-…` §3.4, §5.5). | Drop policies/table/fn; onboarding falls back to service-role. |
| **M4** | `0014_audit_logs` | Append-only `audit_logs` (+ indexes, immutability trigger, RLS — no UPDATE/DELETE) (`05-…` §2.2–2.5). | Drop trigger/table (audit history is append-only by design — drop is a deliberate ops action). |
| **M5** | `0015_billing` | `plans` + `subscriptions` tables, enums, RLS (tenant-read / platform-write) (`02-…` §5; `05-…` §1.2). Seed `plans` catalog; insert diner `subscriptions` row as `enterprise/active`. | Drop tables/types; entitlement resolver returns `enterprise` for all (no behavior change). |
| **M6** | `0016_provisioning` | `provision_restaurant()` + optional `seed_demo_cocktails()` `SECURITY DEFINER` fns (`04-…` §1.3). | `drop function`. |
| **M7** | `0017_soft_delete` | `restaurants.deleted_at` + partial active index; rewrite public/menu read policies to add `deleted_at is null` (`05-…` §3.4). | Drop column/index; restore original public-read policy from `schema.sql:224`. |
| **M8** | `0018_private_storage` | `cocktail-private` bucket + member-scoped write policies (slug-folder pattern) (`04-…` §3.3). | Drop bucket policies + bucket (no app dependency until Phase 5 wiring). |

> Partitioning `events`/`audit_logs` for retention (`05-…` §3.5) is a later, separate migration once volume warrants it — not blocking.

### 3.3 Introducing auth without breaking the single-tenant demo

The constraint is **diner must keep working** (live menu + printed QR codes that point at flat paths using `window.location.origin` + slug, `admin/qr/page.tsx`). Strategy:

1. **Keep legacy flat routes alive** as permanent aliases. Do **not** remove `/`, `/admin/*`, `/api/track`. Middleware resolves a request with no `/r/{slug}` and no tenant subdomain to the default tenant `diner` — every existing link/QR resolves byte-for-byte (`04-…` §2.3 migration path).
2. **Public diner menu stays anonymous.** Auth gates only `/admin/*`, `/platform/*`, and mutating `/api/*` (matcher excludes `/api/track` and public menu reads, `03-…` §2.3). Diners never see a login.
3. **Seed diner an owner + entitlement.** Create one Supabase Auth user, link as `restaurant_members(diner, owner)` via service-role (one-time), and insert the diner `subscriptions` row as `enterprise/active` (M5). The demo admin is now logged-in, not open.
4. **Resolver returns `enterprise` for everyone initially** (M5/4.2) so feature gates are inert until Stripe lands — auth can ship in Phase 0 with zero capability regression.
5. **Flip clients module-by-module** (0.4): swap `createAdminSupabase`→`createServerSupabase` per repo behind tests, so a regression is isolated to one module, not the whole app.

### 3.4 Backfill needs

- **Business tables:** **none.** All already tenant-scoped (`schema.sql:43,108,140,157,167,179`); no `restaurant_id` backfill, no row rewrites.
- **Seed continuity:** one diner owner membership + one diner `subscriptions` row (`enterprise/active`) so existing dashboards keep rendering once auth + billing exist (M5, §3.3 step 3).
- **Storage:** optional — migrate flat `public/cocktail/*` seed assets into `cocktail-assets/diner/…`, or keep diner as a legacy `public/` special-case and make only new tenants bucket-only (`04-…` §3.4).

### 3.5 Rollout & rollback

**Rollout (per phase):**
1. Apply the phase's additive migrations to a **PITR-cloned staging** project first; run the two-tenant contract tests.
2. Ship behind a flag where possible (e.g. resolver returns `enterprise` for all until billing is live).
3. Deploy app changes module-by-module (clients, then routes) so each is independently revertible.
4. Smoke-test the diner public menu + admin login + `/api/track` after every deploy (rotate-guide §5 acceptance: site loads, APIs 200, menu renders, analytics works).

**Rollback:**
- **Migrations** are additive/`drop`-reversible (table above); reverting code that *uses* a new table is independent of the table existing, so app rollback never requires a DB rollback.
- **Phase 0 secret rotation is irreversible by design** (the leaked keys must stay dead) — there is no rollback; only roll forward by fixing env wiring.
- **Bad migration** → PITR-restore to just before it, re-apply the fixed version (numbered migrations are the replay source of truth, `05-…` §3.6).
- **Service-role key re-leak** → rotate again immediately; audit `audit_logs` (once M4 lands) for anomalous writes; treat as full-DB compromise (`05-…` §3.6).

---

## 4. Sequencing summary (one glance)

```
Phase 0  ROTATE SECRETS → AUTH → RLS-client → fix mutators → session-tenant → harden ingest/SSRF   [CRITICAL, blocks all]
Phase 1  roles+permissions, single tenant resolver, helpers, invitations
Phase 2  platform_admins, /platform console, audit_logs, secure impersonation
Phase 3  provision_restaurant(), onboarding route, /r/{slug} URL strategy (diner aliases preserved)
Phase 4  plans+subscriptions, entitlement resolver, Stripe, server-side feature gates
Phase 5  soft-delete, per-tenant export/restore, PITR+drills, retention jobs, private storage
```

**The single most important sentence:** rotate the leaked secrets and add authentication before onboarding a second tenant — until then the multi-tenant database protects nothing, because every request runs as service-role with no identity.

---

*All current-state claims verified against `supabase/schema.sql`, `src/lib/supabase/{server,restaurant}.ts`, the route/repository files cited, and the recon bundle. Detailed designs and DDL live in docs 02–06; secret rotation steps in `docs/SECURITY-rotate-secrets.md`. This document changes no application code.*
