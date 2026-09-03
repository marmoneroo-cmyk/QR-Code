---
name: feedback-design-restraint
description: "User explicitly values cinematic restraint over overdesigned effects — luxury feels minimal, not maximalist"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f00f8822-a2c6-4061-8d50-863cebe3ce6c
---

The user (acting as creative director on 2026-05-27) drew a hard line between "lots of effects" and "luxury experience". They critiqued an earlier version as approaching "Vegas casino UI" / "fashion website template" and asked to dial down.

**Why:** Their target market is high-end restaurants where the brand language is editorial / Michelin / Bon Appétit / Vogue — not gaming or fashion-template energy. Over-motion kills the premium feeling instantly.

**How to apply:**
- **Particles / motion**: keep slow, blurry, sparse — "dust in expensive air", not "magic sparkles". 18 particles, not 36. Long durations (30-60s), large size with blur, low max-opacity (~0.7).
- **Spotlights / glows**: should feel almost subconscious. Mouse-follow at ~0.035 alpha, 1000px radius. Never sharp/intense.
- **Marquees / scrolling text**: very slow (120s+ cycle), wide letter-spacing (0.7em+), low opacity (0.25 or less). Editorial restraint, not fashion template.
- **Hover/active states**: subtle drop-shadow + dim siblings, not bouncing scale + bright halos.
- **When in doubt**: remove an effect rather than add one. The hit they're looking for is "this would be photographed and shared", not "wow what a website".

**Validated approaches (user explicitly liked):**
- Bidirectional hover glow (layer ↔ label) with subtle drop-shadow
- 3D tilt on menu card with reflection beneath
- Playfair Display italic + EB Garamond + Frank Ruhl Libre (Hebrew) typography
- Two-tone display title with gradient on one word
- Diamond-flourish dividers (◇ between gold lines)

**Reject these patterns:**
- Bright fast-moving sparkles
- Aggressive mouse-follow spotlights
- Fast marquees
- Bouncing scale animations on text
- Multiple effects firing simultaneously

**Update 2026-07-05 — Phase-5 A/B verdict (IMPORTANT, supersedes first draft of this note):**
Two directions were built and the user judged BOTH live:
- **v1 "Obsidian & Champagne"** (glass): floating glass capsule nav, GlassCard widgets with hover
  lift, icon-tile launcher with champagne glow, flowing-gradient-border MoneyHero, CtaPill.
  Verdict: *"נראה יותר טוב אבל עדיין מרגיש לי AI כזה"* — good, wants it LESS generic.
- **v2 "The Ledger"** (editorial minimal): no cards at all, hairline rules, numbered text index
  (no icons), solid rectangular CtaSeal, paper grain. Verdict: **"הקודם היה יותר טוב"** — REJECTED.
  Stripping to editorial minimalism went too far / felt bare.

**Standing conclusion:** the user's taste = **v1's rich glass direction is the base language**
(kept in src/components/ui/premium.tsx: GlassCard/CtaPill/AmbientBackdrop/icon launcher).
"Feels AI" is fixed by ADDING distinctiveness ON TOP of the richness — product-specific imagery
(the drinks/food ARE the brand), bespoke details, better composition — NOT by removing richness.
Do not swing to bare minimalism again; refine within the glass language.
