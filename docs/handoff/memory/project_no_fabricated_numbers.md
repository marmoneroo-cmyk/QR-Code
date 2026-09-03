---
name: project-no-fabricated-numbers
description: Admin screens must never render 0/₪0 or a colored verdict when data failed to load — use the NO_MEASUREMENT primitive
metadata: 
  node_type: memory
  type: project
  originSessionId: 863cfba6-3fbc-44be-a19e-ca0befc42724
---

A failed load must never be rendered as a measurement. An owner reads "₪0 revenue" as
"my restaurant sold nothing"; reading it as "the request failed" is not available to them.
**Zero is a claim about the business. A colour is a verdict. Grey is an honest shrug.**

Established 2026-07-20 while sweeping the admin surface (13 screens carried this bug).

- Primitive: `NO_MEASUREMENT` (the string `—`) exported from `@/components/ui/dataviz`.
- Rule: only render a real `0` when the payload actually ARRIVED and said 0. If the fetched
  object is undefined because the load failed/pending, render `NO_MEASUREMENT`.
  `value={overview ? ils(overview.totalRevenue) : NO_MEASUREMENT}` — never `?? 0`.
- Empty-state copy must distinguish the two: `data ? "No items yet." : "Couldn't load…"`.
  Asserting emptiness on an absent payload is a false claim about the menu/business.
- Same rule for STATUS COLOUR, not just numbers: an absent payload must not paint an amber
  "warning" or red "violations found" / "NOT READY" verdict. Use a neutral grey tone
  (`#94a3b8` + `MinusCircle`), as in `admin/signals` (`UNKNOWN_TONE`) and `admin/events`
  (`integrityTone`, which has THREE states: passed / failed / never-checked).
- Legit exception: a category LEGEND chip may keep its category colour as long as its value
  shows `—` (e.g. "warning: —" means "how many warnings is unknown").

**The rule extends past numbers to ATTRIBUTES** (added 2026-07-20). The menu import
hardcoded `dietary: { vegan: true, glutenFree: true }` on every item, and those flags render
as `טבעוני` / `ללא גלוטן` badges on the guest item page — so a scraped ribeye advertised
itself as gluten-free. A guest with celiac ORDERS from that badge. Any guest-facing claim
(dietary, allergen, alcohol-free) must default to **false/absent** and turn on only from
observed source data. A permissive default is a fabrication with consequences.

Careful: not every `?? 0` is this bug. Leave defaults for optional fields INSIDE data that
successfully arrived, and pure arithmetic/derivation helpers (chart geometry, axis scaling).

Related: [[feedback_menu_optimization_vision]] (never fabricate numbers / consultant voice).
