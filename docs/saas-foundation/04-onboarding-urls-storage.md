# 04 — Onboarding, URL Strategy & File Storage

**Multi-Tenant SaaS Foundation Audit · cocktail-demo**
Audience: founder + engineers · Status: documentation / proposal only (no code changed)
Date: 2026-06-09

---

## How to read this document

Every **current-state** claim cites a real file (`path:line`). Anything that does not exist is marked **NOT PRESENT** with the search that confirmed its absence. Everything under a **Proposed** / **Recommended** heading is a design proposal — none of it is implemented yet.

**The one-line context you need:** the database in `supabase/schema.sql` is already structurally multi-tenant (10 RLS-enabled tables, all business tables carry `restaurant_id NOT NULL`, membership-based policies, a slug-scoped storage bucket). But **none of that is enforced at runtime**: there is no app auth (no `middleware.ts`, no `auth/` dir, no login — confirmed NOT PRESENT), every server data path uses the service-role key which **bypasses RLS** (`src/lib/supabase/server.ts:35-51`), and the tenant is a hardcoded constant `TENANT_SLUG = 'diner'` (`src/lib/analytics/queries.ts:31`). This document designs the three pieces that turn that latent multi-tenancy into a real onboarding-driven SaaS: **(1) provisioning**, **(2) URL/tenant-resolution strategy**, **(3) per-tenant file storage**.

---

# 1. Onboarding Workflow — Restaurant Provisioning

## 1.1 Current state (grounded)

| Concern | Current state | Evidence |
|---|---|---|
| How a tenant row is created today | Two ways only: the SQL seed insert for `diner`, and the import route (which does **not** touch the DB). | seed: `supabase/schema.sql:414-416`; import writes files only: `src/app/api/import-restaurant/route.ts:87-88,121-122` |
| Provisioning service | **NOT PRESENT** — no `provision`, `onboard`, or `createRestaurant` function exists. `grep -ri "provision\|onboard" src/` returns nothing. | — |
| Owner / first-user creation | **NOT PRESENT** — no auth, so no user is ever created or linked. `restaurant_members` has **no insert RLS policy** (`supabase/schema.sql:233` is select-only), so even with auth a member can only be added via service-role. | `supabase/schema.sql:233`; auth absent (no `middleware.ts`, no `src/lib/auth/**`) |
| Default branding / theme | Columns exist on `restaurants` (`brand_color`, `logo_url`, `default_lang`) but are only seeded as `default_lang='en'`; no theme defaults applied on create. | `supabase/schema.sql:414-416` |
| Default QR set | **NOT PRESENT** as data — QR codes are generated client-side as data-URLs at view time (`src/app/admin/qr/page.tsx:22-27`), never persisted. No `qr_codes` table. | `src/app/admin/qr/page.tsx` |
| Default settings / menu_experience | **NOT PRESENT** — no row is auto-created in `menu_experience` on tenant creation. | `supabase/schema.sql:157` (table exists, no seed) |
| Demo / seed data | **NOT PRESENT** per-tenant — the live menu is code-defined (`data/cocktail.ts`), not seeded into the `cocktails` table (table is "mostly empty" per schema comment `supabase/schema.sql:64`). | `supabase/schema.sql:64` |
| Transactionality / idempotency | **NOT PRESENT** — nothing to make transactional yet. The only idempotency anywhere is `on conflict (slug) do nothing` on the seed (`supabase/schema.sql:416`) and `getRestaurantId`'s process cache (`src/lib/supabase/restaurant.ts:4,13`). | `supabase/schema.sql:416` |

**Net:** there is no onboarding pipeline. A new restaurant cannot be created through the product today; it would require a manual `INSERT` into `restaurants` plus a manual `restaurant_members` link via service-role.

## 1.2 What "provision a restaurant" must do (atomic unit of work)

When a restaurant is created, **all** of the following must succeed or **none** must persist:

1. **Restaurant row** — insert into `restaurants` with a unique `slug`, `name`, `default_lang`, `brand_color`, `logo_url`. (`slug` already has a unique constraint — `supabase/schema.sql:slug unique`.)
2. **Owner membership** — insert into `restaurant_members(restaurant_id, user_id, role='owner')`. Requires the owner's `auth.users` id to exist first (see §1.5 for the invite/first-login path).
3. **Default menu experience** — insert one `menu_experience(restaurant_id, slug, config)` row with a starter config (`unique(restaurant_id,slug)` — `supabase/schema.sql:161`).
4. **Default branding/theme** — applied as part of step 1 (no separate table; branding lives on `restaurants`). Fill `brand_color`/`logo_url` with platform defaults if not supplied.
5. **Default QR set** — create the storage **folder** `{slug}/qr/` and, optionally, pre-render the table-level QR PNGs server-side into it (see §3). QR is currently ephemeral/client-side; persisting a default set is a new capability.
6. **Analytics setup** — no per-tenant analytics provisioning is required: `events`/`cocktail_funnel` are already partitioned by `restaurant_id` (`supabase/schema.sql:108,343`). Provisioning should simply **verify** the tenant resolves (warm the `getRestaurantId` cache) and emit a `restaurant_provisioned` audit/event marker.
7. **Optional demo data** — behind a flag, insert a handful of demo `cocktails` + `cocktail_layers`/`cocktail_labels` and synthetic `events` so the new owner's dashboards are not empty on first login.
8. **Storage scaffold** — create the canonical folder tree under `cocktail-assets/{slug}/` (see §3.2).

**Idempotency key:** the `slug`. Re-running provisioning for an existing slug must be a no-op for steps that already succeeded (upsert semantics), never a duplicate or a partial overwrite.

## 1.3 Where it should live — recommendation

Three candidate homes, evaluated:

| Option | Atomicity | RLS posture | Pros | Cons | Verdict |
|---|---|---|---|---|---|
| **A. Postgres function (`provision_restaurant(...)`) `SECURITY DEFINER`** | **Strong** — single DB transaction; all-or-nothing is native | Runs as definer, so it can write `restaurant_members` despite the missing insert policy (`supabase/schema.sql:233`) without a service-role key | True transaction; idempotent via `ON CONFLICT`; auditable in one place; no app-layer orchestration of partial failures | Cannot create the `auth.users` owner (that is Supabase Auth, not SQL) or create storage folders/QR PNGs; SQL-only logic is harder to test | **Use for the DB-write core (steps 1–4, 7)** |
| **B. Next.js API route (`POST /api/admin/provision`)** | Weak on its own (multiple awaits, no rollback) unless it *calls* the Postgres fn | Uses service-role today (no auth) → must be gated behind super-admin auth before it ships | Can orchestrate Auth (invite owner), storage folders, QR rendering, demo seeding; easy to test | Not transactional by itself; on partial failure needs explicit compensation | **Use as the thin orchestrator** that calls the Postgres fn, then does Auth + storage |
| **C. Pure client-side (admin UI)** | None | Would run under service-role with no gate (current `/admin/*` is open — `src/app/admin/page.tsx:1`) | — | Unsafe; no transaction; cross-tenant writable today | **Reject** |

**Recommended split:** a **`SECURITY DEFINER` Postgres function** `provision_restaurant()` owns the atomic DB writes (idempotent, single transaction), wrapped by a **thin authenticated API route** `POST /api/admin/provision` that handles the non-SQL side effects (Auth owner invite, storage folder scaffold, QR pre-render, cache warm). The route must be gated by a **super-admin check** — which does not exist yet (`super_admin` role is **NOT PRESENT**; `restaurant_members.role` is constrained to `owner|manager|staff` only — `supabase/schema.sql:35`). Gating is a prerequisite, tracked in the auth workstream.

### Proposed Postgres function (proposal — not implemented)

```sql
-- PROPOSAL — provisioning core. Transactional + idempotent by slug.
-- SECURITY DEFINER lets it insert restaurant_members despite the
-- missing insert RLS policy (schema.sql:233), without a service-role key.
create or replace function provision_restaurant(
  p_slug         text,
  p_name         text,
  p_owner_user   uuid,                 -- must already exist in auth.users
  p_default_lang text default 'en',
  p_brand_color  text default null,
  p_logo_url     text default null,
  p_seed_demo    boolean default false
)
returns restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant restaurants;
begin
  -- 1. Tenant row (idempotent on unique slug)
  insert into restaurants (slug, name, default_lang, brand_color, logo_url)
  values (p_slug, p_name, p_default_lang, p_brand_color, p_logo_url)
  on conflict (slug) do update
    set name = excluded.name              -- safe re-run
  returning * into v_restaurant;

  -- 2. Owner membership (unique(restaurant_id,user_id) — schema.sql)
  insert into restaurant_members (restaurant_id, user_id, role)
  values (v_restaurant.id, p_owner_user, 'owner')
  on conflict (restaurant_id, user_id) do update set role = 'owner';

  -- 3. Default menu experience (unique(restaurant_id,slug) — schema.sql:161)
  insert into menu_experience (restaurant_id, slug, config)
  values (v_restaurant.id, 'default', '{}'::jsonb)
  on conflict (restaurant_id, slug) do nothing;

  -- 7. Optional demo data (gated)
  if p_seed_demo then
    perform seed_demo_cocktails(v_restaurant.id);   -- separate proposed fn
  end if;

  return v_restaurant;
end;
$$;
```

> Notes: column names (`config`) must be confirmed against `supabase/schema.sql:157-161` before implementing. `seed_demo_cocktails` is a proposed sibling function, not designed here. The whole function body is one implicit transaction — any failure rolls back all inserts, satisfying the atomicity requirement.

### Proposed orchestrator route (proposal — not implemented)

```ts
// PROPOSAL — POST /api/admin/provision  (super-admin gated; gate is a prerequisite)
// Orchestrates the side effects the SQL fn cannot do.
export async function POST(req: Request) {
  // 0. AUTH GATE — super_admin only. NOT PRESENT today; must be added first.
  await requireSuperAdmin(req);              // proposed

  const input = provisionSchema.parse(await req.json());  // zod validation at boundary

  // 1. Ensure owner auth user exists (invite or fetch)
  const ownerUserId = await ensureOwnerUser(input.ownerEmail); // Supabase Auth admin

  // 2. Atomic DB provisioning (single transaction, idempotent)
  const restaurant = await rpcProvisionRestaurant({ ...input, ownerUserId });

  // 3. Storage scaffold + default QR set (idempotent: create-if-missing)
  await scaffoldTenantStorage(restaurant.slug);   // see §3.2
  await renderDefaultQrSet(restaurant.slug);       // see §3 (optional)

  // 4. Warm tenant cache so first dashboard read resolves instantly
  await warmRestaurantCache(restaurant.slug);      // getRestaurantId (restaurant.ts:7)

  return Response.json({ success: true, data: restaurant });
}
```

**Compensation / idempotency at the route layer:** because steps 1, 3, 4 are outside the DB transaction, each must be **independently idempotent** (invite = "create or fetch"; scaffold = "create folder if absent"; cache warm = naturally idempotent). If step 2 fails, nothing is committed and the route returns an error; a retry with the same `slug` converges to the same state.

## 1.4 Sequence diagram (text)

```
Super-Admin (UI)        POST /api/admin/provision        Supabase Auth        Postgres (provision_restaurant)        Storage (cocktail-assets)
      |                          |                              |                          |                                   |
      |  submit {slug,name,      |                              |                          |                                   |
      |  ownerEmail,...}         |                              |                          |                                   |
      |------------------------->|                              |                          |                                   |
      |                          | requireSuperAdmin()  [GATE — NOT PRESENT yet]            |                                   |
      |                          |-----------------------------(verify)                     |                                   |
      |                          |                              |                          |                                   |
      |                          | ensureOwnerUser(ownerEmail)  |                          |                                   |
      |                          |----------------------------->| invite/create user       |                                   |
      |                          |<-----------------------------| ownerUserId              |                                   |
      |                          |                              |                          |                                   |
      |                          | rpc provision_restaurant(...)   [ONE TRANSACTION]        |                                   |
      |                          |--------------------------------------------------------->| BEGIN                             |
      |                          |                              |                          |  insert restaurants (on conflict) |
      |                          |                              |                          |  insert restaurant_members owner  |
      |                          |                              |                          |  insert menu_experience default   |
      |                          |                              |                          |  [seed_demo if flag]              |
      |                          |<---------------------------------------------------------| COMMIT -> restaurant row          |
      |                          |                              |                          |                                   |
      |                          | scaffoldTenantStorage(slug)  |                          |                                   |
      |                          |------------------------------------------------------------------------------------------->| mkdir {slug}/{logos,drinks,...}
      |                          | renderDefaultQrSet(slug)     |                          |                                   |
      |                          |------------------------------------------------------------------------------------------->| put {slug}/qr/*.png
      |                          | warmRestaurantCache(slug)    |                          |                                   |
      |                          |                              |                          |                                   |
      |<-------------------------| 200 {success, restaurant}    |                          |                                   |
      |                          |                              |                          |                                   |
   (owner receives invite email -> first login -> lands on /r/{slug}/admin -> sees demo dashboards)
```

## 1.5 Owner invite & first login

- **Today:** **NOT PRESENT.** No `invitations` table, no email, no Auth. `restaurant_members` cannot be written by a normal user (no insert policy — `supabase/schema.sql:233`).
- **Proposed:** use **Supabase Auth admin invite** (`inviteUserByEmail`) to mint the owner's `auth.users` row, pass its id into `provision_restaurant` as `p_owner_user`, then the owner sets a password on first login. The `SECURITY DEFINER` function performs the `restaurant_members` insert that RLS would otherwise block. An optional `invitations` table can back manager/staff invites later (role from the `owner|manager|staff` enum — `supabase/schema.sql:35`), but is not required for the owner path.

---

# 2. URL Strategy & Tenant Resolution

## 2.1 Current state (grounded)

- Tenant is **never resolved from the URL**. It is the hardcoded constant `TENANT_SLUG = 'diner'` (`src/lib/analytics/queries.ts:31`), duplicated as a literal `'diner'` default across `src/lib/closedloop/server.ts:63`, `src/lib/tracking/queue.ts:17`, `src/app/api/track/route.ts:76`, and others.
- Resolution slug→UUID is `getRestaurantId(slug)` via a service-role lookup with a per-process `Map` cache (`src/lib/supabase/restaurant.ts:7-15`); `/api/track` reimplements the same inline (`src/app/api/track/route.ts:14-26`).
- Routes are **path-flat, not tenant-scoped**: `/admin/*`, `/api/track`, `/api/promotions`, etc. There is **no `/r/{slug}/` segment** and **no subdomain handling** — confirmed no `middleware.ts` exists to do host/path rewriting (NOT PRESENT).
- The only places a tenant can vary today are the API routes that read `restaurant`/`restaurantSlug` from the request body/param (e.g. `src/app/api/track/route.ts:76`), and those are unauthenticated — the cross-tenant risk documented in the API audit.

**Implication:** there is currently no URL-driven tenant model at all. Choosing one is greenfield; the constraint is only that **existing diner links and QR codes must keep working**.

## 2.2 Evaluation matrix

Three industry-standard options:

- **Option A — Path-based:** `platform.com/r/{slug}` (e.g. `platform.com/r/diner`)
- **Option B — Subdomain:** `{slug}.platform.com` (e.g. `diner.platform.com`)
- **Option C — Custom domains:** `menu.diner.com` mapped to the tenant

| Dimension | A — Path `/r/{slug}` | B — Subdomain `{slug}.platform.com` | C — Custom domain |
|---|---|---|---|
| **Tenant resolution** | Trivial: read `params.slug` in a route/segment or `middleware.ts`; no DNS. Lowest-effort given today's flat routes. | Read `Host` header in `middleware.ts`, strip base domain → slug. Needs middleware (NOT PRESENT). | Read `Host`, look up a `domain → restaurant_id` mapping table (NOT PRESENT). Most lookups. |
| **Cookie / session isolation** | **Weak** — all tenants share `platform.com` origin; one cookie jar. Session/auth cookies must be namespaced by tenant in-app; risk of bleed if careless. Also affects today's shared `localStorage` (`src/lib/useLang.ts`, `src/lib/tracking/session.ts`). | **Strong** — each subdomain is a distinct origin; cookies scoped per subdomain by the browser automatically. Best isolation for the eventual auth layer. | **Strongest** — fully separate origin per tenant. |
| **RLS / security** | RLS unaffected by URL shape (it keys on `auth.uid()` membership — `supabase/schema.sql:233`). But path slug is trivially user-editable, so the **server must derive tenant from the authenticated session/membership, never trust the path slug**. | Same RLS; host is still client-supplied but harder to fan out across; combined with per-origin cookies, lowers cross-tenant cookie-replay risk. | Same RLS; domain ownership (DNS TXT verification) adds an out-of-band trust signal. |
| **SEO** | One domain accrues all authority; clean for a marketing site, but tenant menus share a domain (fine for a SaaS, less "branded"). | Subdomains are treated as separate sites by search engines — each tenant builds its own authority; good for tenant-branded menus. | Best for tenant brand SEO (their own domain), zero benefit to the platform domain. |
| **TLS / wildcard cost** | **Lowest** — single cert for `platform.com`; nothing per-tenant. | Needs a **wildcard cert** `*.platform.com` (one cert, auto on Vercel/most hosts) — low but non-zero. | **Highest** — per-domain certs (ACME automation), one per tenant; ongoing issuance/renewal ops. |
| **Ops complexity** | **Lowest** — no DNS, no certs, no middleware required (though middleware recommended). Ship today. | Medium — wildcard DNS + middleware host parsing + reserved-subdomain handling (`www`, `app`, `api`). | **Highest** — per-tenant DNS onboarding UX, domain verification, cert lifecycle, support burden. |
| **Future migration** | Cleanest starting point; everything downstream (auth, RLS) is URL-shape-agnostic. | Natural next step from A. | End-state for enterprise tenants who want their own brand. |

## 2.3 Recommendation: **A now → B → C**

1. **Now — Option A (`platform.com/r/{slug}`).** Lowest cost, zero DNS/cert work, and it forces the single most important refactor regardless of final shape: **resolve tenant per-request instead of from the `TENANT_SLUG` constant** (`src/lib/analytics/queries.ts:31`). Introduce a `middleware.ts` (NOT PRESENT today) or a `[slug]` route segment that extracts the slug and threads it (plus the **authenticated** membership check) into the data layer. **Critical security rule:** the path slug selects *which* tenant the user is *trying* to view; authorization to view it must come from `restaurant_members` (`auth.uid()`), never from the slug alone — otherwise this just re-exposes the cross-tenant read/write holes the API audit found.

2. **Next — Option B (`{slug}.platform.com`).** Add a wildcard `*.platform.com` cert + DNS and extend `middleware.ts` to parse the `Host` header → slug, falling back to the path form. This buys real **per-origin cookie/session isolation** for the auth layer and per-tenant SEO. Because the in-app tenant resolution from step 1 is already host/path-agnostic, this is a middleware-only change.

3. **Later — Option C (custom domains).** Add a `tenant_domains` table (`domain TEXT UNIQUE → restaurant_id`, NOT PRESENT today), domain-verification UX (DNS TXT), and per-domain cert automation. Resolution becomes: `Host` → `tenant_domains` lookup → `restaurant_id`. Reserve for paid/enterprise tiers.

### Migration path that does not break existing links

The diner menu and all printed QR codes today point at flat paths on the current origin (QR uses `window.location.origin` + slug — `src/app/admin/qr/page.tsx`). To avoid breaking them:

- **Keep the legacy flat routes alive** as permanent aliases that internally resolve to `slug='diner'`. Do **not** remove `/`, `/admin/*`, `/api/track` paths.
- When introducing A, add `middleware.ts` rewrites: a request with **no** `/r/{slug}` and **no** tenant subdomain resolves to the default tenant (`diner`) — preserving every existing link and QR code byte-for-byte.
- New tenants get `/r/{slug}` URLs from day one; diner can be **dual-homed** (`/` and `/r/diner` both work) until you choose to 301 the old paths.
- Moving A→B: the path form stays valid; subdomains are additive. Old QR codes (path-form) keep resolving via the same default-tenant rewrite.
- Moving B→C: custom domains are additive lookups; subdomain and path forms remain valid. No tenant ever loses a working URL.

**Net:** because the load-bearing change is "resolve tenant per request + authorize via membership" (done once, in middleware/data layer), the URL *shape* can evolve A→B→C without ever invalidating a previously issued link or QR.

---

# 3. File Storage — Per-Restaurant Layout

## 3.1 Current state (grounded)

| Asset class | Where it lives today | Tenant-isolated? | Evidence |
|---|---|---|---|
| Drink hero / layer images (seed tenant) | Static files in flat `public/cocktail/` (e.g. `/cocktail/glass.png`) | **No** — flat, shared, world-readable; referenced as root-relative paths | `src/data/cocktail.ts:91` |
| 360 frames / 3D `.glb` / depth maps | `public/cocktail/360/`, `public/cocktail/3d/`, `public/cocktail/depth/` | **No** — static public | `public/cocktail/3d/diner-aperol-spritz.glb` |
| Imported / AI-generated drink images | Written to **server FS** `public/cocktail/drafts/{slug}-hero.png` | **No** — slug is only a filename prefix; ephemeral on Vercel | `src/app/api/import-restaurant/route.ts:87-88,121-122` |
| Admin-uploaded hero photo | **Not uploaded** — read into a base64 **data URL** via `FileReader.readAsDataURL`, stored inline as `heroImage` string | n/a (never leaves browser to storage) | `src/components/.../CocktailForm.tsx:445-452` |
| QR codes | Generated **client-side** as data URLs, downloaded to user disk | **No** — never persisted server-side | `src/app/admin/qr/page.tsx:22-27` |
| PDF exports | **NOT PRESENT** — no `jspdf`/`html2canvas`; "export" is browser `window.print()` only | n/a | `src/app/admin/qr/page.tsx`, `src/app/admin/print/page.tsx` |
| Supabase `cocktail-assets` bucket | **Declared** (public-read, member-scoped writes) but **never written to by app code** — no `storage.from().upload()` anywhere in `src/**` | Policy is correct but **unused** | bucket: `supabase/schema.sql:374-409`; convention doc: `supabase/README.md:41` |

**Two facts that drive the design:**
1. The bucket and its RLS already exist and are correct — writes are restricted to the folder whose first path segment equals the writer's restaurant slug: `restaurants.slug = (storage.foldername(name))[1]` **AND** the writer is a member (`supabase/schema.sql:382-389`). The app simply **never uses it**.
2. The bucket is **public-read for every object** (`for select using (bucket_id = 'cocktail-assets')` — `supabase/schema.sql:379`). That is fine for menu imagery but **wrong for private artifacts** (sales exports, raw imports) — anyone who guesses a path can fetch them.

## 3.2 Recommended per-restaurant folder structure

Adopt a single canonical prefix per tenant inside the existing bucket, keyed by slug so the **existing** RLS policy (`foldername[1] = slug`) applies unchanged:

```
cocktail-assets/                         (existing bucket, public-read — schema.sql:374)
└── {restaurant-slug}/                   (= (storage.foldername(name))[1] in RLS — schema.sql:387)
    ├── logos/        ← brand logo, favicon            (PUBLIC — shown on menu)
    ├── drinks/       ← hero + layer images per cocktail (PUBLIC — shown on menu)
    │   └── {cocktail-slug}/{layer_id}.png   (matches README convention :41)
    ├── food/         ← food item imagery               (PUBLIC — shown on menu)
    ├── qr/           ← rendered table QR PNGs           (PUBLIC — printed/scanned)
    ├── generated/    ← AI/import working images         (PUBLIC once promoted; see note)
    ├── imports/      ← raw scraped/uploaded source data (PRIVATE — signed URLs)
    └── exports/      ← sales CSV / PDF / report exports  (PRIVATE — signed URLs)
```

**Public vs private classification:**

| Folder | Visibility | Rationale |
|---|---|---|
| `logos/`, `drinks/`, `food/`, `qr/` | **Public** | Rendered in the diner-facing menu; must be CDN-cacheable and anonymously fetchable. |
| `generated/` | **Public after promotion** | AI working images become menu images once accepted; keep public, or stage in `imports/` until promoted. |
| `imports/`, `exports/` | **Private** | Raw source data and revenue/PII-adjacent exports (e.g. `sales` data — private per `supabase/schema.sql` sales policies). Must **not** be world-readable. |

## 3.3 Mapping to the existing RLS policy — and what must change

The current storage policies (`supabase/schema.sql:378-409`):

- **SELECT:** `using (bucket_id = 'cocktail-assets')` — **public read of everything.** (`:379`)
- **INSERT / UPDATE / DELETE:** member-of-`foldername[1]`-slug. (`:382-409`)

The **write** policies already do exactly what the folder structure needs: a member of `diner` can only write under `diner/...`. **No change required for writes** — the proposed tree slots straight in. The single broken assumption is **public read of private folders**.

**Recommended change — split read visibility by top-level public/private bucket, not by folder.** Supabase storage object policies cannot easily branch SELECT on a sub-path *and* keep CDN caching clean, so the cleanest model is **two buckets**:

```sql
-- PROPOSAL — keep cocktail-assets public-read (logos/drinks/food/qr/generated),
-- and add a PRIVATE bucket for imports/exports served via signed URLs only.

insert into storage.buckets (id, name, public)
values ('cocktail-private', 'cocktail-private', false)   -- NOT public
on conflict (id) do nothing;

-- No public SELECT policy on cocktail-private => objects are only reachable
-- via short-lived signed URLs minted server-side after a membership check.

-- Member-scoped write, identical slug-folder pattern as the public bucket
-- (mirrors schema.sql:382-389), just a different bucket_id:
create policy "Members write their private folder" on storage.objects
for insert with check (
  bucket_id = 'cocktail-private'
  and exists (
    select 1 from restaurants
    join restaurant_members on restaurant_members.restaurant_id = restaurants.id
    where restaurants.slug = (storage.foldername(name))[1]
      and restaurant_members.user_id = auth.uid()
  )
);
-- (repeat update/delete policies analogously)
```

Then:
- **Public assets** (`logos/drinks/food/qr/generated`) stay in `cocktail-assets` under `{slug}/...` — existing policies already correct (`supabase/schema.sql:378-409`).
- **Private assets** (`imports/exports`) move to `cocktail-private/{slug}/...` and are served **only** via server-minted **signed URLs** (`createSignedUrl`) after a `restaurant_members` membership check. Never expose their paths publicly.

**Alternative (single-bucket) approach:** keep one bucket but **replace the blanket public SELECT** with a policy that only permits anonymous read of public sub-folders:

```sql
-- PROPOSAL (single-bucket variant) — restrict public read to public folders only.
drop policy if exists "Public read of cocktail assets" on storage.objects;
create policy "Public read of public folders" on storage.objects
for select using (
  bucket_id = 'cocktail-assets'
  and (storage.foldername(name))[2] in ('logos','drinks','food','qr','generated')
);
-- imports/exports then have NO public read; members read via signed URLs / member policy.
```

The **two-bucket** approach is recommended (cleaner CDN semantics, no risk of a path-segment policy mistake exposing private data).

## 3.4 What the app must start doing (today it does none of this)

These are the concrete code changes implied (proposed — not implemented):

1. **Actually use the bucket.** No `storage.from().upload()` exists anywhere (`src/**`). Replace the base64-data-URL hero path (`src/components/.../CocktailForm.tsx:445-452`) and the FS-write import path (`src/app/api/import-restaurant/route.ts:87-122`) with uploads to `cocktail-assets/{slug}/drinks|generated/...`. This also fixes the Vercel-ephemeral-FS problem (drafts written to `public/` do not persist).
2. **Render QR server-side into `{slug}/qr/`** during provisioning (§1.2 step 5) so a tenant has a durable, shareable QR set instead of regenerating client-side each visit (`src/app/admin/qr/page.tsx`).
3. **Add a signed-URL endpoint** for `imports/exports` that checks membership before minting a short-TTL `createSignedUrl`. (Today there are no exports at all — `jspdf`/`html2canvas` NOT PRESENT — so this lands alongside the first real export feature.)
4. **Migrate existing static `public/cocktail/*` seed assets** into `cocktail-assets/diner/{drinks,...}` so the seed tenant follows the same model (or keep them in `public/` as a legacy special-case for diner only; new tenants are bucket-only).

---

# Appendix — "NOT PRESENT" confirmations (each verified)

| Thing | Status | How confirmed |
|---|---|---|
| Provisioning / onboarding function | **NOT PRESENT** | no `provision`/`onboard`/`createRestaurant` in `src/**` |
| App auth (`middleware.ts`, `auth/` dir, login) | **NOT PRESENT** | glob over repo returns only `node_modules` hits |
| `super_admin` / platform role | **NOT PRESENT** | `restaurant_members.role` enum = `owner|manager|staff` only (`supabase/schema.sql:35`) |
| `restaurant_members` insert RLS policy | **NOT PRESENT** | only a select policy exists (`supabase/schema.sql:233`) |
| `invitations` table | **NOT PRESENT** | absent from `schema.sql` + all migrations |
| `qr_codes` / `tenant_domains` tables | **NOT PRESENT** | absent from schema; QR is client-side (`src/app/admin/qr/page.tsx`) |
| Subscriptions / billing / plans | **NOT PRESENT** | no table, no code reference |
| `audit_logs` (security) | **NOT PRESENT** | `changes` is a per-tenant **content** log (`supabase/migrations/_archive/0010_changes.sql:2`), not a security audit log |
| PDF export (`jspdf`/`html2canvas`) | **NOT PRESENT** | not in deps; export = `window.print()` |
| Any `storage.from().upload()` call | **NOT PRESENT** | bucket declared (`supabase/schema.sql:374`) but unused by app code |
| URL-based tenant resolution | **NOT PRESENT** | tenant is constant `TENANT_SLUG='diner'` (`src/lib/analytics/queries.ts:31`) |

> **Reminder:** every proposal in §1–§3 is a design recommendation only. No application code was modified in producing this document.
