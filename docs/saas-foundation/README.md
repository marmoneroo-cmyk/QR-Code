# Multi-Tenant SaaS Foundation — Audit & Implementation Plan

> **Status:** documentation only — no application code was changed in producing this audit.
> **Start here:** [`00-executive-summary-and-audit.md`](./00-executive-summary-and-audit.md)
> **Review grade:** an independent adversarial reviewer graded this audit **A** — coverage complete, **zero fabricated current-state claims** (≈12 load-bearing claims re-verified against the real code).

## The one-paragraph verdict

The **database is already a well-architected multi-tenant system** — every business table carries `restaurant_id NOT NULL` and RLS is enabled on all 10 tables with correct membership policies. But the **running application enforces none of it**: every server path uses the Supabase **service-role key (which bypasses RLS)**, there is **no authentication at all** (no `middleware.ts`, no login, `/admin/*` is open), and the tenant is a hardcoded `TENANT_SLUG='diner'`. So the good schema is **dormant**. On top of that, the platform layer doesn't exist yet — **no Super Admin, no billing/subscriptions, no security audit log, no soft-delete**. This is not a schema problem; it's an **enforcement** problem. Authentication is the single blocking prerequisite. **Do not onboard a second tenant until Gates 0–4 (below) are green.**

## Deliverable map

| # | Doc | Covers |
|---|-----|--------|
| 00 | [Executive Summary & Audit](./00-executive-summary-and-audit.md) | Verdict · architecture (current vs target) · current-system audit · ranked security findings · isolation summary · Definition-of-Done gates |
| 01 | [Roadmap · Risk · Migration](./01-roadmap-risk-migration.md) | Phased roadmap (Phase 0 = stop-the-bleed) · risk matrix · ordered DB migration & rollback plan |
| 02 | [Tenant Isolation & RLS](./02-tenant-isolation-and-rls.md) | Protected / unprotected / needs-migration table lists · current + recommended RLS SQL · the service-role problem · new-table DDL |
| 03 | [Auth · Roles · Super Admin](./03-auth-roles-superadmin.md) | Supabase Auth + middleware · role matrix · permissions matrix · `/platform` console · Restaurants List · secure impersonation |
| 04 | [Onboarding · URLs · Storage](./04-onboarding-urls-storage.md) | Provisioning workflow · URL strategy (path → subdomain → custom domain) · per-tenant storage structure |
| 05 | [Billing · Audit · Backups](./05-billing-audit-backups.md) | Plans & feature gating · `subscriptions` + Stripe design · canonical `audit_logs` · soft-delete · PITR/DR |
| 06 | [Pen-test · Session · Analytics](./06-pentest-session-analytics.md) | Ranked attack vectors (exploitable today) · session/JWT design · analytics tenant-isolation & required event fields |

## Top findings (all exploitable today, no credentials needed)

1. **Cross-tenant promotion write/delete** — `updatePromotion`/`deletePromotion` scope by raw `id`, no `restaurant_id` (`promotions/repository.ts:107-121`). **Critical**
2. **Unauthenticated tenant-targeted writes** — `promotions`/`sales`/`experience`/`changes` take the tenant from the request body and write under service-role. **Critical**
3. **Open `/admin/*` + service-role = full cross-tenant console**, linked from the public menu. **Critical**
4. **RLS never enforced at runtime** — service-role everywhere, `auth.uid()` always null. **Critical**

Single root cause for #1–#4: **service-role bypass + no auth.** Fix those two and most of the table collapses.

## Phase 0 — do this first (stop-the-bleed)

1. **Rotate the exposed Supabase secrets** (service_role / sb_secret / DB password were pasted into chat) — see [`../SECURITY-rotate-secrets.md`](../SECURITY-rotate-secrets.md).
2. **Add authentication** (Supabase Auth + `middleware.ts`) gating `/admin/*` and all mutating `/api/*`.
3. **Stop using service-role for tenant CRUD** — route tenant reads/writes through the cookie-bound anon client so **RLS becomes the live boundary**. Reserve service-role for `/api/track` ingest and explicit platform jobs.
4. **Derive tenant from the session**, never from URL/body; close the known `id`-only write holes.

## Feature freeze (per the founding directive)

No net-new restaurant features ship until **Gates 0–4** in [`00` §6](./00-executive-summary-and-audit.md#6-definition-of-done--foundation-gates) are green (security + isolation). Gates 5–6 (platform data model, backups) must be green before charging money or scaling tenant count.
