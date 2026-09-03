---
name: feedback-data-moat-metadata
description: "The competitive moat is the DATA, not the product working — so capture lineage/outcome/lifecycle/versioning metadata BEFORE connecting AI to real data; it can't be backfilled"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 863cfba6-3fbc-44be-a19e-ca0befc42724
---

The owner's governing principle for this project (stated repeatedly, 2026-06-13): the product has
passed the "will it work" risk. The real risk now is **whether the data collected over the next 6
months will be high-quality enough to become a competitive advantage.** Therefore **metadata quality
matters more than the algorithm** — "metadata > algorithm; the asset isn't customer data, it's the
history of what the AI advised and what actually happened."

**Why:** the moment the engine runs on real restaurant data, anything not captured at write-time is
nearly impossible to reconstruct. A nice product becomes a *system that learns over years* only if it
recorded the right provenance from day one.

**How to apply:** before ANY work that connects the AI/engine to real data (Epic H-B), and before adding
features, ask "what metadata can't we backfill?" and stamp it NOW. Already shipped: `eventVersion`,
`eventSource`, `restaurantType`, `menuCategory`, `uiVersion`, and the in-memory recommendation provenance
envelope ([[project-current-status]] / J1–J2). Still required before H-B (owner-ordered): Dataset Health
Dashboard (J3), Data Lineage + Recommendation Ledger (J3.5/J4), Outcome Ledger (J4.5 — recommended-but-
ignored vs recommended-and-done), Recommendation Lifecycle (J4.6), and **Menu Versioning** (J5 — a
`menu_version` per dish that bumps on image/price/description/position change, stamped on every event,
same can't-backfill class as uiVersion). Wire the *stamp* at the start of each, even if the UI comes later.
Plus the causal-knowledge layer (J10–J12): J10 Resolution (HOW a change was executed — pro shoot vs phone
snap — capture objective before/after asset signals, not self-rated quality), J11 Competition (timeline of
CONCURRENT changes so a measured lift isn't mis-attributed — a refinement to Epic F's honest measurement;
confounded windows must be flagged), and **J12 Negative Knowledge** (store FAILURES and null outcomes with
equal fidelity — zero survivorship bias — plus confidence prior→posterior; the failures are the real edge).

**The mission, sharpened (owner, 2026-06-13):** the goal is NOT a system that knows what's happening in a
menu — it is a system that **accumulates over years causal knowledge of which actions improve which dishes,
under which conditions, for which restaurant types, at what confidence, including what fails.** Not a menu
product — an **organizational learning system for the restaurant industry.** That reframes the moat: it's not
the data, it's the *causal knowledge*.

**The 3 knowledge layers (the conceptual model for all of Epic J):** ① **Reality** — what guests did (events +
their stamps); most products stop here. ② **Hypothesis** — what the AI thought (recommendation provenance,
lineage, ledger, confidence); good AI products reach here. ③ **Learning** — what the world taught the AI
(outcome, override, resolution, confounding, negative knowledge, lifecycle, and **J13 counterfactual** = what
happened when a rec was NOT implemented / implemented-but-flat). **Very few systems reach Layer ③ — it is the
moat.** J13's cheap-now part is a measurement discipline: re-measure a dish after a recommendation REGARDLESS
of whether it was acted on (don't only measure the wins). Dashboard's most important panel = **Knowledge
Health** (Learning Coverage = % of recs that reached a terminal verified/negative state), not event volume.
**Decision-guiding principle:** a sound Layer ③ means the engine can be WRONG early and still compound
(`good Reality → wrong Intelligence → excellent Learning`) — so DON'T block on engine accuracy or over-tune the
engine; invest in the learning layer that lets it self-correct. The moat is the `did → thought → happened` chain.
**As of 2026-06-13 the conceptual architecture is CLOSED (J1–J13); from here the value is in EXECUTION quality
(A5 → J3 → J4 → F → H-B), not inventing new epics.** Sequence is in `docs/saas-foundation/production-readiness-sprint.md`
(Epic J = J1–J12, now complete for the learning goal). Security (A5 rotate, then the J-block) comes before the
AI ever reasons over real data. Relates to [[feedback-menu-optimization-vision]].
