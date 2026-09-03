---
name: project-brand
description: "First restaurant tenant is \"Diner\". Used as the default restaurant_slug and as branding placeholder until user changes it."
metadata: 
  node_type: memory
  type: project
  originSessionId: f00f8822-a2c6-4061-8d50-863cebe3ce6c
---

User confirmed (2026-05-27) the first restaurant tenant is named **"Diner"**. Slug: `diner`.

**How to apply:**
- When seeding the database, the first row in `restaurants` is `{ slug: 'diner', name: 'Diner' }`.
- When building multi-tenant routes (`/r/[slug]/...`), default redirect for the bare `/` is `/r/diner/menu`.
- Brand assets (logo, primary color) are TBD — the user hasn't specified yet. Until then, the existing dark luxury palette + Playfair Display typography applies.

**Note:** the name "Diner" is plain — not the same luxury-restaurant tonality we built the UI around. The user may want to revisit brand naming later. Don't push back unsolicited; mention if relevant.

Supabase project keys + GitHub repo URL pending — user said they'll send "later".
