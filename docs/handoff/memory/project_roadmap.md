---
name: project-roadmap
description: "Full feature roadmap for cocktail-demo platform — diner features, restaurant CMS features, kiosk mode, platform infra, organized by priority tiers"
metadata: 
  node_type: memory
  type: project
  originSessionId: f00f8822-a2c6-4061-8d50-863cebe3ce6c
---

User explicitly approved building this entire roadmap (2026-05-27). Execute in sprints; don't try in one go.

## 🍸 Diner-facing features

**MVP (must have for v1):**
- Categories + multi-menu (cocktails / food / wine / desserts)
- Search + filters (vegan, gluten-free, alcohol-free, allergens)
- Favorites
- "Out of stock today" badge respected from CMS

**Differentiators (these make the product unique):**
- Share to Instagram — auto-generates beautiful shareable image card per item
- Flavor Profile Radar chart (Sweet/Bitter/Smoky/Citrus/Herbal)
- Ingredient origin ("Tanqueray London Dry", "Persian Lime")
- Pairings ("Pairs well with oysters")
- Bartender / chef note (single elegant line of human voice)
- Gyroscope (mobile: tilting phone moves the layers in 3D)
- Soft sound (glass tick, ice crack, ambient bar — subtle, never autoplay loud)

**Future (cool but not first):**
- Order at table + Pay (Apple Pay / Bit)
- Bill split between diners
- AR view (phone camera → cocktail on table)
- Order tracking
- Reorder previous items
- Loyalty points

## 🏪 Restaurant CMS / Admin features

**MVP:**
- CMS to add/edit/delete items (no developer required)
- Availability toggle ("sold out today")
- Multi-language content editor (EN/HE minimum)

**CORE DIFFERENTIATOR (the moat):**
- **AI photo → 3D breakdown generator**: owner uploads one product photo; system runs background removal + segmentation + image-gen for missing splash/garnish components → automatic vertical-layer breakdown. No one else does this. Pipeline: Pollinations/fal.ai + @imgly/background-removal + custom segmentation.

**High priority:**
- Multi-branch (chain restaurant, different menus per location)
- Custom branding (logo, colors, fonts, custom domain `menu.restaurant.com`)
- Analytics (most viewed, most ordered, conversion view→order, time on each item)
- POS integration (Toast, Square, Cash POS)
- Multi-currency + auto-translate via AI

**Future:**
- A/B testing of descriptions and photos
- Order management dashboard (if accepting orders)
- Inventory tracking (ingredient out → all items using it hidden)
- Staff accounts with permissions
- Training mode

## 📺 Kiosk / Entrance display mode

- Auto-loop through items on big screen
- Touch mode for interactive
- Schedule (breakfast / lunch / dinner / happy hour)
- Brand intro video between items

## 💰 Platform / SaaS infrastructure

- Multi-tenant architecture
- Auth (restaurant accounts)
- Subscription billing (~₪299/month or tiered)
- White-label support
- QR code generator (per table, per item)
- PWA / Mobile app shell
- Print kit (table tents, posters with QR)

## Recommended sprint order

**Sprint 1 (next, ~5-7 days):**
1. Multiple cocktails in MENU + categories
2. Flavor Profile Radar in item page
3. Ingredient Origin + Bartender Note in item page

**Sprint 2:** Share to Instagram, Search + basic Filters

**Sprint 3:** AI Photo → 3D Breakdown (the moat — most complex but most valuable)

**Sprint 4:** Multi-tenant CMS + Auth

**Sprint 5+:** POS, Analytics, Kiosk mode, etc.

## How to apply
When user asks "what next" or "add X", check this roadmap to see where X fits and what dependencies it has. Don't propose features outside this list unless user explicitly asks for new ideas. Don't skip ahead of dependencies (e.g. CMS needs multi-tenant first).
