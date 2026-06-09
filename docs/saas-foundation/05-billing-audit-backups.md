# 05 — Billing, Audit Logging & Backups / Recovery

**Multi-Tenant SaaS Foundation Audit · cocktail-demo**
Audience: founder + engineers · Status: **DOCUMENTATION / DESIGN ONLY — no code changed.**

This deliverable covers three pillars a multi-tenant SaaS needs before it can charge money, prove who did what, and survive data loss. Every **current-state** claim cites a real file (path + approx line). Anything absent is marked **NOT PRESENT**. Designs are proposals — not implemented.

---

## 0. Current-state snapshot (verified)

| Capability | State | Evidence |
|---|---|---|
| Billing / subscriptions / plans tables | **NOT PRESENT** | No table in `supabase/schema.sql` (210-line schema, full table list lines 20-188); no `subscription\|billing\|stripe\|plan_id` reference anywhere in `src/**` (grep: no matches) |
| Stripe / payment integration | **NOT PRESENT** | No `stripe` dependency referenced in `src/**`; no `/api/billing` or `/api/webhooks` route |
| Feature gating / plan→capability resolver | **NOT PRESENT** | No plan check in any route; the only gating comments are `// NOTE (Phase 2): gate behind restaurant-member auth` (e.g. `src/app/api/sales/route.ts:21`) — auth, not billing |
| Security audit log (actor / IP / UA) | **NOT PRESENT** | `changes` table (`schema.sql:177-188`) is a per-tenant **content** timeline (`change_type, entity_type, before, after, summary, source`) — no `actor_user_id`, `ip`, or `user_agent` column |
| `super_admin` / platform role | **NOT PRESENT** | `restaurant_members.role` constrained to `owner\|manager\|staff` (`schema.sql:35`) |
| Soft-delete (`deleted_at`) | **NOT PRESENT** | No `deleted_at` column on any table; FKs use hard `on delete cascade` (`schema.sql:33,43,73,90,108-109,140,157,167,179`); no `deleted_at` reference in `src/**` (grep: no matches) |
| Per-tenant export / restore | **NOT PRESENT** | No export route; QR/print "export" is client-only `window.print()` (per recon: `admin/qr/page.tsx`) |
| Backups / PITR config | **NOT MANAGED IN REPO** | Supabase platform setting; no IaC/config file in repo asserting a backup policy |
| App authentication (prerequisite for all of the above) | **NOT PRESENT** | No `middleware.ts`, no `auth/` dir, no login; `createAdminSupabase()` (service-role) bypasses RLS (`src/lib/supabase/server.ts:35-51`) |

> **Hard dependency.** Billing entitlement checks, audit-log actor capture, and soft-delete-respecting RLS are all **meaningless without authentication**. Today every server path runs under the service-role key (`server.ts:37,45`), which bypasses RLS, and `/admin/*` is unauthenticated. **Auth (covered in the auth/session deliverable) is the blocking prerequisite for everything below.** The designs here assume `auth.uid()` is a real, logged-in member.

---

# Part 1 — BILLING

## 1.1 Plan tiers & feature-gate matrix

Five tiers. **Trial** is a time-boxed grant of **Pro** capability; on expiry the tenant downgrades to a read-mostly state until they pick a paid plan.

| Plan | Price model | Positioning |
|---|---|---|
| **Trial** | 14 days free, no card | Full Pro features, time-boxed |
| **Starter** | Low monthly | Single venue, core menu + basic analytics |
| **Pro** | Mid monthly | Growth analytics, promotions, A/B, POS import |
| **Premium** | High monthly | Multi-venue, AI tooling, advanced revenue/closed-loop |
| **Enterprise** | Custom / annual | SSO, SLA, white-label, unlimited, audit export |

### Capability matrix

Capabilities are stable string keys (the resolver in §1.4 returns this set). `✓` = enabled, `—` = gated.

| Capability key | Trial | Starter | Pro | Premium | Enterprise |
|---|:--:|:--:|:--:|:--:|:--:|
| `menu.publish` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `menu.experience_config` (per-slug overrides — `menu_experience`, `schema.sql:155`) | ✓ | — | ✓ | ✓ | ✓ |
| `analytics.overview` (funnel/KPIs — `getOverview`, `queries.ts:137`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `analytics.raw_events` (`getRawEvents`, `queries.ts:291`) | ✓ | — | ✓ | ✓ | ✓ |
| `analytics.menu_engineering` (`queries.ts:408`) | ✓ | — | ✓ | ✓ | ✓ |
| `analytics.closed_loop` (attribution) | ✓ | — | — | ✓ | ✓ |
| `promotions` (`promotions/repository.ts`) | ✓ | — | ✓ | ✓ | ✓ |
| `experiments.ab` (events-derived; `experiments/results.ts`) | ✓ | — | ✓ | ✓ | ✓ |
| `sales.import` (POS ingestion — `sales/repository.ts:18`) | ✓ | — | ✓ | ✓ | ✓ |
| `ai.import_restaurant` (`/api/import-restaurant`) | ✓ | — | — | ✓ | ✓ |
| `ai.generate_breakdown` (`/api/generate-breakdown`) | ✓ | — | — | ✓ | ✓ |
| `multi_venue` (>1 restaurant per owner) | — | — | — | ✓ | ✓ |
| `team.members` (invite teammates) | ✓ (cap 2) | ✓ (cap 2) | ✓ (cap 5) | ✓ (cap 15) | ✓ (∞) |
| `branding.white_label` | — | — | — | — | ✓ |
| `sso` | — | — | — | — | ✓ |
| `audit.export` (security log export, Part 2) | — | — | — | ✓ | ✓ |
| `support.priority` | — | — | ✓ | ✓ | ✓ |

### Usage limits (metered — see §1.6)

| Limit key | Trial | Starter | Pro | Premium | Enterprise |
|---|:--:|:--:|:--:|:--:|:--:|
| `limit.venues` | 1 | 1 | 1 | 5 | ∞ |
| `limit.cocktails` | 50 | 25 | 200 | 1000 | ∞ |
| `limit.members` | 2 | 2 | 5 | 15 | ∞ |
| `limit.events_per_month` (ingest via `/api/track`) | 50k | 50k | 500k | 5M | ∞ |
| `limit.ai_generations_per_month` | 25 | 0 | 0 | 500 | ∞ |
| `limit.promotions_active` | 10 | 0 | 25 | 100 | ∞ |

> Limits are **proposals** — tune against real cost once Stripe metering data exists. `∞` is represented as `null` in code (see §1.4 type).

## 1.2 `subscriptions` table model

One subscription row per tenant (`restaurant_id` unique). Plan + status are the source of truth for entitlement; Stripe IDs link to the billing provider.

```sql
-- PROPOSED — not in schema.sql today.
create type plan_tier   as enum ('trial','starter','pro','premium','enterprise');
create type sub_status  as enum ('trialing','active','past_due','canceled','incomplete','unpaid');

create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  restaurant_id          uuid not null unique
                           references restaurants(id) on delete cascade,
  plan                   plan_tier  not null default 'trial',
  status                 sub_status not null default 'trialing',
  trial_end              timestamptz,            -- null once converted
  current_period_end     timestamptz,            -- renewal / access boundary
  cancel_at_period_end   boolean not null default false,
  stripe_customer_id     text unique,            -- cus_…
  stripe_subscription_id text unique,            -- sub_…
  -- denormalized overrides (Enterprise custom deals): null => use plan defaults
  capability_overrides   jsonb,                  -- { "sso": true, ... }
  limit_overrides        jsonb,                  -- { "limit.venues": 12 }
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_status_idx        on subscriptions (status);
create index if not exists subscriptions_stripe_cust_idx   on subscriptions (stripe_customer_id);
create unique index if not exists subscriptions_stripe_sub on subscriptions (stripe_subscription_id);
```

**Lifecycle states** (driven by Stripe webhooks, §1.3):

```
trialing ──(checkout completed / trial→paid)──▶ active
trialing ──(trial_end passes, no card)────────▶ canceled (read-only downgrade)
active   ──(invoice.payment_failed)───────────▶ past_due ──(dunning fails)──▶ unpaid/canceled
past_due ──(invoice.paid)─────────────────────▶ active
active   ──(cancel_at_period_end)──(period end)▶ canceled
```

**Access rule:** a tenant is *entitled* when `status in ('trialing','active','past_due')` AND `now() < coalesce(current_period_end, trial_end, 'infinity')`. `past_due` keeps access during the dunning grace window; `canceled`/`unpaid` collapse to the **Starter-or-read-only** floor (writes blocked, menu stays published so diners aren’t affected).

### RLS for `subscriptions`

```sql
alter table subscriptions enable row level security;

-- Owners/managers of the tenant may READ their own subscription (billing UI).
create policy "Members read own subscription" on subscriptions for select using (
  exists (select 1 from restaurant_members m
          where m.restaurant_id = subscriptions.restaurant_id
            and m.user_id = auth.uid()
            and m.role in ('owner','manager'))
);
-- NO insert/update/delete policy for tenants: only the Stripe webhook handler
-- (service-role) mutates this table. Mirrors how events writes are service-role-only
-- (schema.sql:289-295). Prevents a tenant self-upgrading by editing their row.
```

## 1.3 FUTURE Stripe integration design

> Design only. Requires: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` env vars (validated at startup per `~/.claude/rules/typescript/security.md`); the `stripe` SDK; and auth so we know *who* is buying.

### Components

1. **Checkout (acquisition).** `POST /api/billing/checkout` (auth-gated, owner only) → resolves the tenant → `getRestaurantId` (`restaurant.ts:7`) → creates/reuses a Stripe Customer (store `stripe_customer_id`) → creates a Checkout Session for the chosen `STRIPE_PRICE_<PLAN>` → returns the session URL. `client_reference_id = restaurant_id` so the webhook can map back.
2. **Customer Portal (self-service).** `POST /api/billing/portal` (owner only) → Stripe Billing Portal session for `stripe_customer_id` → tenant manages card, upgrades/downgrades, cancels. No bespoke billing UI to maintain.
3. **Webhooks (source of truth).** `POST /api/webhooks/stripe`:
   - **MUST** verify `stripe-signature` with `STRIPE_WEBHOOK_SECRET` before parsing (reject otherwise — this endpoint is the one place that writes `subscriptions`).
   - **MUST** read the **raw** request body (Next.js: disable body parsing / use `req.text()`), or signature verification fails.
   - Idempotent: store processed `event.id` (dedupe table or `metadata`) to tolerate Stripe retries.
   - Runs under **service-role** (no tenant session in a webhook) and writes `subscriptions` directly.

### Webhook → subscription state sync

| Stripe event | Action on `subscriptions` |
|---|---|
| `checkout.session.completed` | Set `stripe_subscription_id`, `plan` (from price), `status='active'`, clear `trial_end` |
| `customer.subscription.updated` | Sync `plan`, `status`, `current_period_end`, `cancel_at_period_end` |
| `customer.subscription.deleted` | `status='canceled'` (downgrade to floor) |
| `invoice.paid` | `status='active'`, bump `current_period_end` |
| `invoice.payment_failed` | `status='past_due'` (enter dunning) |
| `customer.subscription.trial_will_end` | Notify tenant (email); no state change |

### Dunning

Lean on **Stripe Smart Retries + Dunning** (automatic retry schedule + branded emails) rather than hand-rolling. On `invoice.payment_failed` → `past_due` (grace, still entitled). If Stripe exhausts retries → `customer.subscription.deleted` → `canceled` → write-floor. Surface an in-app banner while `past_due` (resolver exposes `status` to the UI).

```ts
// PROPOSED shape — src/lib/billing/stripe-webhook.ts (does not exist yet)
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub); // service-role upsert on subscriptions, keyed by stripe_subscription_id
      return;
    }
    case 'invoice.payment_failed':
      await markPastDue(event.data.object as Stripe.Invoice);
      return;
    // … checkout.session.completed, invoice.paid …
    default:
      return; // ignore unhandled types
  }
}
```

## 1.4 Feature gating — enforced SERVER-SIDE

**Principle:** entitlement is decided **on the server**, from the DB, on every privileged request. The client may *hint* affordances but **never** decides access — same lesson as the current cross-tenant write holes (e.g. `updatePromotion(id)` has no tenant check, `promotions/repository.ts:94-115`): never trust the caller.

### Plan → capabilities resolver (single source of truth)

```ts
// PROPOSED — src/lib/billing/entitlements.ts (does not exist yet)
export type Capability =
  | 'promotions' | 'experiments.ab' | 'sales.import'
  | 'analytics.raw_events' | 'analytics.closed_loop'
  | 'ai.import_restaurant' | 'ai.generate_breakdown'
  | 'multi_venue' | 'audit.export' | 'sso' | 'branding.white_label';

export type LimitKey =
  | 'limit.venues' | 'limit.cocktails' | 'limit.members'
  | 'limit.events_per_month' | 'limit.ai_generations_per_month'
  | 'limit.promotions_active';

interface Plan { capabilities: ReadonlySet<Capability>; limits: Record<LimitKey, number | null>; } // null = ∞

const PLANS: Record<PlanTier, Plan> = { /* the §1.1 matrix, frozen */ };

export interface Entitlement {
  plan: PlanTier;
  status: SubStatus;
  isEntitled: boolean;                 // status + period check (§1.2)
  can(cap: Capability): boolean;
  limitOf(key: LimitKey): number | null;
}

// Resolve once per request from the subscriptions row (+ overrides), process-cache like restaurant.ts:4.
export async function getEntitlement(restaurantId: string): Promise<Entitlement> { /* … */ }
```

### Enforcement points

1. **API routes (mandatory gate).** Every privileged route resolves the entitlement after auth and rejects with **402 Payment Required** (or 403) before doing work. This is where the existing `// NOTE (Phase 2): gate …` comments (`sales/route.ts:21`, `promotions/route.ts:21`, `experience/route.ts:23`) should land — *auth first, then entitlement*.

   ```ts
   // PROPOSED guard usage inside e.g. promotions POST
   const ent = await getEntitlement(restaurantId);
   if (!ent.isEntitled) return json(402, { error: 'subscription_inactive' });
   if (!ent.can('promotions')) return json(403, { error: 'plan_upgrade_required', capability: 'promotions' });
   ```

2. **Middleware (coarse gate).** Once `middleware.ts` exists (NOT PRESENT today), it can short-circuit whole route groups: block `/admin/ai/**` unless `ai.*`, block writes when `!isEntitled`. Middleware is a coarse net; **per-route checks remain authoritative** (middleware can’t see the specific resource/capability cheaply).

3. **Server Components / loaders.** Admin pages read the entitlement server-side and render the upgrade state instead of the gated panel — no gated data is ever sent to a non-entitled client.

### UI affordances (advisory only)

- Expose a read-only `useEntitlement()` (hydrated from a server-rendered, signed value) to show lock badges, "Upgrade to Pro" CTAs, disabled buttons, and a `past_due` billing banner.
- **The UI gate is cosmetic.** A motivated caller can hit the API directly (today, anyone can — there’s no auth), so the server check in (1) is the real boundary. Never gate solely in React.

## 1.5 Migration path from today

1. Add `subscriptions`; backfill the seed `diner` tenant (`schema.sql:414`) as `enterprise/active` so nothing breaks.
2. Ship the resolver returning **`enterprise` for everyone** initially (no behavior change), then flip routes to honor it once auth + Stripe land.
3. Wire Checkout/Portal/webhooks. Default new signups to `trialing` with `trial_end = now()+14d`.

## 1.6 Metering for usage-based limits

- **Events (`limit.events_per_month`):** `/api/track` already stamps `restaurant_id` server-side (per recon, `track/route.ts:52,83`) and the schema indexes `(restaurant_id, created_at)` (`schema.sql:193`). Compute monthly usage with a cheap `count(*) where restaurant_id=? and created_at >= date_trunc('month', now())`; when over the cap, **soft-throttle** (drop-with-200 or sample) rather than hard-fail diner tracking. A nightly job can roll counts into a `usage_counters(restaurant_id, period, metric, value)` table to avoid scanning `events`.
- **Cocktails / members / active promotions:** point-in-time `count(*)` per tenant at write time; reject the create that would exceed `limitOf(...)`.
- **AI generations (`limit.ai_generations_per_month`):** today `/api/import-restaurant` and `/api/generate-breakdown` have **no metering and no auth** (per recon) — costly outbound AI calls are unbounded. Gate behind `ai.*` capability **and** increment a per-tenant monthly counter before calling Pollinations.
- **Stripe usage-based billing (optional):** for metered overages, report usage to Stripe via metered prices on the period boundary; keep the local counter authoritative for *enforcement* and Stripe authoritative for *invoicing*.

---

# Part 2 — AUDIT LOGGING

## 2.1 Why `changes` is not enough

`changes` (`schema.sql:177-188`) is a **content** changelog: `change_type, entity_type, entity_id, before, after, summary, source('auto'|'manual')`. It answers *"what did this menu look like before/after?"* It does **NOT** record **who** (no `actor_user_id`), **from where** (no `ip`), or **with what client** (no `user_agent`), and it has no notion of platform-level / security events (login, role change, impersonation). It is therefore **NOT a security audit log**. We add a dedicated, append-only `audit_logs` table alongside it. (`changes` stays as the product-facing "what changed on the menu" timeline used by Closed-Loop attribution.)

## 2.2 `audit_logs` schema

```sql
-- PROPOSED — not in schema.sql today.
create table if not exists audit_logs (
  id            bigint generated by default as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,  -- null for system/anon
  actor_role    text,                       -- owner|manager|staff|super_admin|system (snapshot at action time)
  impersonator_id uuid null references auth.users(id) on delete set null, -- non-null during impersonation (the real operator); see 03 §7
  restaurant_id uuid references restaurants(id) on delete set null, -- NULL = platform-level event
  action        text not null,              -- see §2.4 (e.g. 'role.change')
  target_type   text,                       -- 'restaurant' | 'member' | 'promotion' | 'subscription' | 'session' | …
  target_id     text,                       -- uuid/slug of the affected entity
  ip            inet,                        -- request source IP
  user_agent    text,                        -- request UA string
  metadata      jsonb not null default '{}'::jsonb,  -- action-specific (old_role→new_role, plan deltas, reason)
  created_at    timestamptz not null default now()
);

create index if not exists audit_logs_restaurant_idx on audit_logs (restaurant_id, created_at desc);
create index if not exists audit_logs_actor_idx      on audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_action_idx     on audit_logs (action, created_at desc);
create index if not exists audit_logs_created_brin   on audit_logs using brin (created_at);  -- cheap range scans, like idx_events_occurred_brin (schema.sql:199)
```

> **Canonical schema.** This `audit_logs` DDL is the single source of truth for the table (named as such in the roadmap, doc 01). Docs 02 §5.3 and 03 §7 point here instead of redefining it. Key invariants: PK is `bigint generated by default as identity`, the timestamp column is `created_at` (not `occurred_at`), and `impersonator_id uuid null` is present so impersonation logging (03 §7) has a home.

Notes:
- `restaurant_id` is **nullable** so platform events (a `super_admin` creating/deleting a tenant, a global login) have a home with no tenant.
- `impersonator_id` is **nullable** — populated only during impersonation with the real operator's `auth.uid()` (03 §7); `actor_user_id` then holds the impersonated identity.
- `actor_role` is **snapshotted** (denormalized) so the record stays truthful even if the member’s role later changes or their membership is deleted.
- `ip`/`user_agent` come from request headers in the API layer (`x-forwarded-for`, `user-agent`) — they are **not** captured anywhere today (the analytics path deliberately avoids UA per recon, so this is net-new and security-scoped).

## 2.3 Append-only design

Append-only is what makes an audit log trustworthy. Enforce in layers:

1. **No UPDATE/DELETE policies** (RLS, §2.5) — even tenant owners can only `select`.
2. **Revoke `update,delete`** from the `authenticated` role on the table; only the writer path (service-role, via a `logAudit()` helper) inserts.
3. **Optional DB guard** — a `before update or delete` trigger that `raise exception` makes immutability defense-in-depth even against service-role mistakes:

   ```sql
   create or replace function audit_logs_immutable() returns trigger as $$
   begin raise exception 'audit_logs is append-only'; end;
   $$ language plpgsql;
   create trigger audit_logs_no_mutate
     before update or delete on audit_logs
     for each row execute function audit_logs_immutable();
   ```
4. **Retention via partition drop, not row delete** (§3.5) — expiry happens by dropping whole monthly partitions, preserving the no-DELETE invariant for live data.

```ts
// PROPOSED — src/lib/audit/log.ts (does not exist yet). Service-role insert; never throws into the request path.
export async function logAudit(entry: {
  actorUserId: string | null; actorRole: string | null;
  restaurantId: string | null; action: AuditAction;
  targetType?: string; targetId?: string;
  ip?: string; userAgent?: string; metadata?: Record<string, unknown>;
}): Promise<void> { /* createAdminSupabase().from('audit_logs').insert(...) — best-effort, log-and-swallow on failure */ }
```

> **Failure semantics — one exception.** General audit logging is **best-effort / fail-open**: a failed `logAudit()` write is swallowed so it never breaks the request path (above). The **sole exception is impersonation start/stop**, which is **fail-closed**: if the `impersonation.start` (or `.stop`) audit write fails, the impersonation is **denied/aborted** — no impersonation without a durable log entry. See `03-auth-roles-superadmin.md` §7. Callers logging `impersonation.*` must therefore await the write and treat a failure as fatal, not swallow it.

## 2.4 Exact events to log

| `action` | When | `restaurant_id` | Key `metadata` |
|---|---|---|---|
| `auth.login` | Successful sign-in | null or tenant | `method` (password/sso), `mfa` |
| `auth.login_failed` | Failed sign-in attempt | null | `email_attempted` (hashed), `reason` |
| `auth.logout` | Sign-out | tenant | — |
| `member.role_change` | `restaurant_members.role` changes | tenant | `target_user_id`, `old_role`, `new_role` |
| `member.invite` / `member.remove` | Membership add/remove | tenant | `target_user_id`, `role` |
| `restaurant.create` | New tenant provisioned | tenant (new) | `slug`, `name` |
| `restaurant.delete` | Tenant soft/hard-deleted | tenant | `slug`, `mode` (soft/hard) |
| `menu.change` | Cocktail/menu/experience write | tenant | `entity_type`, `entity_id`, `change_type` (cross-ref `changes.id`) |
| `promotion.change` | Promotion create/update/delete | tenant | `promotion_id`, `op` |
| `sales.import` | POS rows ingested | tenant | `period_start`, `period_end`, `rows` |
| `billing.change` | Plan/status change (from webhook) | tenant | `old_plan→new_plan`, `old_status→new_status`, `stripe_event_id` |
| `impersonation.start` / `impersonation.stop` | Super-admin assumes/leaves a tenant context | tenant | `reason`, `ticket_id` |
| `security.rls_denied` / `security.rate_limited` | Policy/abuse triggers | tenant or null | `route`, `detail` |
| `data.export` | Tenant export bundle generated (§3.2) | tenant | `bundle_id`, `row_counts` |

> **Highest-value events** for this app specifically: `member.role_change`, `billing.change`, `impersonation.*`, `restaurant.delete`, and `data.export`. These are the irreversible / money / privilege-escalation actions.

## 2.5 RLS for `audit_logs`

```sql
alter table audit_logs enable row level security;

-- super_admin reads EVERYTHING (platform + all tenants).
-- Requires a super_admin concept, which is NOT PRESENT today (role is owner|manager|staff,
-- schema.sql:35). Proposed: a platform_admins(user_id) table OR a JWT claim is_super_admin.
create policy "Super admins read all audit logs" on audit_logs for select using (
  exists (select 1 from platform_admins p where p.user_id = auth.uid())
);

-- Owners read their OWN tenant's NON-SECURITY subset only.
-- (Security/auth rows like login_failed, rls_denied, impersonation are hidden from tenants
--  to avoid leaking attack/recon detail; only super_admin sees those.)
create policy "Owners read own non-security audit logs" on audit_logs for select using (
  restaurant_id is not null
  and action not like 'security.%'
  and action not like 'auth.login_failed'
  and action not like 'impersonation.%'
  and exists (select 1 from restaurant_members m
              where m.restaurant_id = audit_logs.restaurant_id
                and m.user_id = auth.uid()
                and m.role = 'owner')
);

-- NO insert/update/delete policies → no tenant can write or tamper (append-only, §2.3).
-- Writes happen via service-role logAudit() only.
```

The "non-security subset" is enforced by `action` prefix filtering so an owner sees menu/promotion/billing/member history for their venue but not raw auth-failure or impersonation traces.

---

# Part 3 — BACKUPS / RECOVERY

## 3.1 Supabase PITR (platform-level safety net)

- **State today:** **NOT MANAGED IN REPO.** No backup/PITR config or IaC asserting a policy exists in the codebase; it is a Supabase project setting.
- **Recommendation:**
  - Enable **Point-in-Time Recovery** on the Supabase project (Pro plan add-on). Target **≥ 7-day** PITR window initially; raise to 30 days before onboarding paying tenants.
  - Keep Supabase **daily logical backups** as the coarse net; PITR as the fine-grained one.
  - Document the project ref, plan, PITR window, and who can trigger a restore in an ops runbook (not in the repo secrets).
- **Caveat — PITR is whole-project, not per-tenant.** Restoring via PITR rewinds **all** tenants to a timestamp. It is the right tool for "the database is corrupted/dropped," the **wrong** tool for "tenant X needs their data from Tuesday." That gap is exactly why per-tenant export/restore (§3.2) and soft-delete (§3.4) exist.

## 3.2 Per-restaurant EXPORT (tenant data bundle)

**State today: NOT PRESENT** (no export route; QR/print "export" is client-only).

**Design:** `POST /api/admin/restaurants/[slug]/export` (auth-gated, owner/super_admin only) emits a **single JSON bundle** containing every tenant-scoped row plus an asset manifest. Because every business table carries `restaurant_id` (`schema.sql:43,108,140,157,167,179`) and layers/labels join via `cocktail_id`, the bundle is a deterministic set of filtered queries.

```jsonc
// PROPOSED bundle shape — restaurant-export-v1
{
  "schema": "restaurant-export-v1",
  "exported_at": "2026-06-09T12:00:00Z",
  "restaurant": { /* restaurants row */ },
  "members":     [ /* restaurant_members (user_id pseudonymized unless super_admin) */ ],
  "cocktails":   [ /* cocktails where restaurant_id = ? */ ],
  "cocktail_layers": [ /* via cocktail_id ∈ cocktails */ ],
  "cocktail_labels": [ /* via cocktail_id ∈ cocktails */ ],
  "promotions":  [ /* where restaurant_id = ? */ ],
  "menu_experience": [ /* where restaurant_id = ? */ ],
  "sales":       [ /* where restaurant_id = ? */ ],
  "changes":     [ /* where restaurant_id = ? */ ],
  "subscriptions": { /* the tenant's subscription, §1.2 */ },
  "events": { "included": false, "note": "high-volume; exported separately as NDJSON on request" },
  "asset_manifest": [
    // Storage convention is cocktail-assets/{slug}/… (schema.sql:387), but per recon the
    // bucket is UNUSED — drink images live in public/cocktail/* and inline base64 heroImage.
    { "kind": "hero", "cocktail_slug": "aperol-spritz", "ref": "public/cocktail/diner-aperol-spritz-hero.png" }
  ]
}
```

Order of rows respects FK dependencies (restaurant → cocktails → layers/labels) so the same bundle restores cleanly. Emit an `audit_logs` `data.export` entry (§2.4) on every export.

## 3.3 Per-restaurant RESTORE / import

- `POST /api/admin/restaurants/import` (super_admin only) consumes a `restaurant-export-v1` bundle.
- **Modes:** `new` (provision a fresh `restaurant` + remap to a new `id`, slugify-collision-safe) or `overwrite` (restore into an existing tenant — wrap in a transaction; replace child rows by natural key, e.g. `unique(restaurant_id,slug)` on cocktails, `schema.sql:67`).
- **Validate** the bundle with a Zod schema (`restaurant-export-v1`) before any write (boundary validation per coding-style rules); reject unknown schema versions.
- Re-link assets: copy manifested files into the destination (and, when the Storage bucket is finally used, into `cocktail-assets/{newSlug}/…`).
- Log `restaurant.create` (mode=`import`) to `audit_logs`.

## 3.4 Soft-delete (`deleted_at`)

**State today: NOT PRESENT** — FKs hard-cascade (`on delete cascade`, e.g. `schema.sql:33,43,108`); deleting a `restaurants` row **irreversibly** wipes all child data. There is no recovery short of PITR.

**Design — add `deleted_at timestamptz` to `restaurants` (and optionally `cocktails`, `promotions`):**

```sql
-- PROPOSED
alter table restaurants add column if not exists deleted_at timestamptz;
create index if not exists restaurants_active_idx on restaurants (id) where deleted_at is null;
```

**Cascade & RLS interaction:**
- **Deletion becomes a soft update:** `update restaurants set deleted_at = now()` instead of `delete`. The hard `on delete cascade` FKs stay as a *last-resort* hard-purge path (run only after the retention window, §3.5).
- **RLS must respect `deleted_at`.** Every public-read and member policy gains `and restaurants.deleted_at is null`. Concretely, the public restaurant read (`schema.sql:224`) and the menu reads (cocktails published policy, `:237`) must additionally check the parent restaurant is not soft-deleted, so a soft-deleted tenant’s menu **stops serving to diners immediately** even though rows persist. Example:

  ```sql
  -- PROPOSED replacement for "Restaurants are viewable by everyone" (schema.sql:224)
  create policy "Active restaurants are viewable by everyone" on restaurants
    for select using (deleted_at is null);
  ```
- **App queries** add `.is('deleted_at', null)` at the tenant-resolution step (`getRestaurantId`, `restaurant.ts:11`) so a soft-deleted slug resolves to `null` and every downstream `.eq('restaurant_id', …)` filter yields nothing — a one-line chokepoint that propagates everywhere.
- **Undelete** = `set deleted_at = null` within the retention window (recover from accidental deletion without touching PITR).

## 3.5 Data retention policy

| Data class | Live retention | After | Rationale |
|---|---|---|---|
| Soft-deleted tenants (`restaurants.deleted_at`) | **30 days** recoverable | hard-purge (cascade delete) | Undo window before irreversible wipe |
| `audit_logs` | **24 months** | drop oldest monthly partition | Compliance / forensics; append-only (§2.3) |
| `events` (raw analytics) | **13 months** rolling | aggregate → drop raw | Keeps YoY trends; caps table growth (already BRIN-indexed by time, `schema.sql:199`) |
| `sales` | retained while tenant active | purge on hard-delete | Revenue history |
| Export bundles (at rest) | **7 days** signed-URL TTL | delete | Minimize PII copies |
| Stripe data | Per Stripe + legal hold | — | Provider-managed |

Implement raw-event aging and audit-log/event partition drops as a scheduled job (Supabase cron / pg_cron). Partitioning `events` and `audit_logs` by month makes retention a cheap `drop partition` rather than a giant `delete`.

## 3.6 Disaster-recovery runbook

**Targets (proposed):** RPO ≤ 24h (logical backup) / ≤ 5 min (PITR window); RTO ≤ 2h for full restore, ≤ 30 min for single-tenant restore.

| Scenario | Procedure |
|---|---|
| **Accidental tenant delete** | If within 30d soft-delete window: `set deleted_at = null` (§3.4) — seconds. If hard-purged: PITR clone (below) → export that tenant (§3.2) → import into prod (§3.3). |
| **Single-tenant data corruption** | Spin a **PITR clone** of the project at T-before-corruption → run the §3.2 export scoped to the tenant against the clone → §3.3 `overwrite` import into prod. Production stays up for all other tenants. |
| **Full database loss / drop** | Supabase PITR restore to latest healthy timestamp (§3.1). Rotate `SUPABASE_SERVICE_ROLE_KEY` if loss involved a credential leak. Re-seed nothing — restore is authoritative. |
| **Bad migration** | Restore via PITR to just before the migration; re-apply fixed migration. Numbered migrations in `supabase/migrations/` are the replay source of truth (schema.sql header, lines 5-9). |
| **Service-role key leak** | **Rotate `SUPABASE_SERVICE_ROLE_KEY` immediately** (per security rules); audit `audit_logs` for anomalous writes; because this key bypasses RLS (`server.ts:35-51`), treat any leak as full-DB compromise. |
| **Storage/asset loss** | Re-generate from prompts (`hero_prompt`, `cocktails.hero_prompt`, `schema.sql:54`; layer `generation_prompt`, `:82`) or restore from export `asset_manifest` (§3.2). |

**Runbook hygiene (proposed, kept out of the repo):** quarterly **restore drills** (prove the export→import path actually round-trips), documented owner + escalation path, and a checklist that every DR action writes an `audit_logs` entry.

---

## Appendix A — Net findings & priority

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | **No billing layer at all** — no `subscriptions`, no Stripe, no entitlement resolver. Cannot charge or gate features. | HIGH (business-blocking) | Part 1 |
| 2 | **No security audit log** — `changes` (`schema.sql:177-188`) lacks actor/IP/UA; login, role change, impersonation, billing changes are unrecorded. | HIGH | Part 2 |
| 3 | **No soft-delete; hard cascades** (`on delete cascade`, `schema.sql:33,43,108`) — a single tenant delete is irreversible short of whole-project PITR. | HIGH | §3.4 |
| 4 | **No per-tenant export/restore** — the only granular recovery path for one tenant is missing; PITR is all-or-nothing. | MEDIUM | §3.2–3.3 |
| 5 | **PITR/backups not asserted in repo** — backup posture is undocumented and unverified. | MEDIUM | §3.1 |
| 6 | **No `super_admin`** (`role` ∈ owner\|manager\|staff, `schema.sql:35`) — blocks cross-tenant audit reads, impersonation logging, and restore tooling. | MEDIUM | §2.5 / cross-ref auth deliverable |
| 0 | **Prerequisite:** none of the above is enforceable without **auth** (service-role bypasses RLS, `server.ts:35-51`; `/admin/*` open). | CRITICAL | auth/session deliverable |

**Top finding:** This is a structurally multi-tenant database with **zero monetization, audit, or recovery scaffolding** and **no auth to enforce any of it**. Billing entitlement, audit-actor capture, and soft-delete-respecting RLS all assume a real `auth.uid()` — so **authentication is the single blocking prerequisite**, and `subscriptions` + `audit_logs` + `deleted_at` are the three tables to add immediately after it. Hard `on delete cascade` (§3.4) makes accidental tenant deletion irreversible *today*, so soft-delete is the highest-leverage standalone data-safety fix.

---

*All current-state claims verified against `supabase/schema.sql`, `src/lib/supabase/server.ts`, `src/lib/supabase/restaurant.ts`, and grep over `src/**` (no billing/audit/super_admin/deleted_at references found). Designs are proposals; no application code was modified.*
