<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Language Rule — hospitality voice (owner-facing copy)

The product has **two language layers**. Every user-facing string belongs to one.

## Owner layer — everything a restaurant/bar owner, manager, or operator sees
This is the default. It includes the **Act** group (House Performance, Action Center,
Shift Briefing, Hall of Wins, Opportunities, Closed Loop, Promotions, Sales), the
launcher/nav, empty states, and any insight, recommendation, or briefing copy.

**The system should sound like a restaurant consultant, not a growth marketer.** Every
insight must be understandable without any marketing knowledge.

- **Avoid:** Conversion / המרה, CTR, Engagement / מעורבות, Funnel / משפך, Cohort, Lead, Traffic / תנועה.
- **Prefer:** Orders / הזמנות, Guests / אורחים, Interest / עניין, Demand / ביקוש,
  Visibility / חשיפה, Attention / תשומת לב, Menu Position / מיקום בתפריט, Sales / מכירות, Revenue / הכנסה.
- Phrasings that work: "% שהזמינו", "הזמנות מתוך צפיות", "אחוז הזמנה", "עניין שהפך להזמנה",
  "ככל שיגיעו עוד אורחים".

A jargon word mid-screen ("Conversion Rate") breaks the illusion and drops the owner
back into SaaS-land — that's the whole thing to avoid.

## Expert layer — explicit Advanced Mode / Analytics surfaces only
The **Analytics** screen, the **Advanced** group (Executive, A/B Tests, Inspector, Signals),
and the live conversion **Funnel** are for people who came looking for analytics. There,
marketing terms (Conversion, CTR, Funnel, Cohort) are fine and expected.

When unsure which layer a string is in, treat it as **owner layer**.

# Foundation Freeze — multi-tenant SaaS hardening before features

The product is becoming a multi-tenant SaaS platform. A full grounded audit lives in
[`docs/saas-foundation/`](docs/saas-foundation/README.md) (start at `00-executive-summary-and-audit.md`).

**Headline:** the database is already multi-tenant (every business table has `restaurant_id`,
RLS is enabled), but the runtime enforces none of it — the server uses the **service-role key
(bypasses RLS)**, there is **no auth** (`/admin/*` is open), and the tenant is a hardcoded
`TENANT_SLUG='diner'`. There is no Super Admin, billing, or security audit log yet.

**Rule:** do **not** build net-new restaurant features until the **Definition-of-Done Gates 0–4**
in `docs/saas-foundation/00-executive-summary-and-audit.md` §6 are green (auth exists; RLS is the
live boundary; tenant is session-derived; known cross-tenant holes closed; roles + super_admin
enforced). Phase 0 first: rotate the exposed Supabase secrets, add authentication, stop using
service-role for tenant CRUD. See `docs/saas-foundation/01-roadmap-risk-migration.md`.

If a request asks for a new tenant-facing feature before those gates pass, flag this freeze and
propose doing the relevant foundation phase first.
