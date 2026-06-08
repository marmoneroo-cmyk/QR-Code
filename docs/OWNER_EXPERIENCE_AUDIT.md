# Owner Experience Audit — 2026-06-07

**Trigger:** the platform now has ~20 admin screens. The risk is no longer missing features —
it's that a restaurant owner logs in, sees a wall of dashboards, and stops using it.
**Goal:** an owner makes a confident decision **within 30 seconds of login**.
**Principle:** fewer destinations, better decisions. Diagnosis (what to do) is separate from
diagnostics (why) — we keep **Opportunities** (the doctor) and **Optimize** (the MRI) distinct.

> Decision: do NOT build more recommendation types next. The next step is consolidation.

---

## 1. Every screen, classified

| Screen | Role | Who / cadence | Tier |
|--------|------|---------------|------|
| **Home Dashboard** *(to build)* | The one destination — summary + top actions | Owner, **daily** | **Home** |
| Opportunities | "What should I do today?" (actions) | Owner, **daily** | **Act** |
| Promotions | Configure discounts / happy hour | Owner/manager, weekly | **Act** |
| Experience | Toggle badges/modules per drink | Owner/manager, weekly | **Act** |
| Sales | Import POS sales (CSV) | Manager, weekly | **Act** |
| Optimize | "Why?" — margin×demand, recommendations | Owner, on-demand | **Understand** |
| Menu Engineering | Star/Plowhorse/Puzzle/Dog matrix | Analyst, on-demand | **Understand** |
| Tables | Per-table engagement | Owner, on-demand | **Understand** |
| Journeys | Per-visitor paths | Analyst, on-demand | **Understand** |
| Heatmap | Which section drew the eye | Analyst, on-demand | **Understand** |
| Analytics | Views/orders/conversion overview | Owner, on-demand | **Understand** |
| Recommendations (Pairings) | Co-view graph | Analyst, rare | **Understand** (merge) |
| Executive | Exec summary | Owner, daily-ish | **→ retire into Home** |
| Signals | Data-quality / readiness gate | Builder, rare | **Advanced** |
| Events | Raw event inspector | Builder, debugging | **Advanced** |
| Experiments | A/B tests | Analyst, rare | **Advanced** |
| Audience (CRM) | Visitor segments (no identity yet) | —, premature | **Advanced / hide** |
| Composer / Import / QR / Print / Kiosk | Menu setup & assets | One-time / rare | **Setup** |
| Changelog | Build log | Internal | **Advanced / footer** |

**Daily (3):** Home, Opportunities, (glance) Promotions status.
**Diagnostic-only:** Optimize, Menu Engineering, Tables, Journeys, Heatmap, Analytics, Pairings.
**Advanced/technical:** Signals, Events, Experiments, Audience.
**Setup (rare):** Composer, Import, QR, Print, Kiosk.

---

## 2. Answers to your five questions

1. **Used daily?** Home + Opportunities. Everything else is on-demand.
2. **Diagnostic only?** Optimize, Menu Engineering, Tables, Journeys, Heatmap, Analytics, Pairings.
3. **Can be merged?**
   - **Executive → Home** (Executive is a weaker Home; retire it).
   - **Analytics + Funnels + Pairings → one "Analytics" workspace** with tabs.
   - **Optimize + Menu Engineering + Heatmap → one "Menu Analysis" workspace** with tabs
     (all answer "why" about a drink). *Opportunities stays separate — it's the "what".*
   - **Signals + Events → one "Data Health"** (advanced).
   - **Tables + Journeys → one "Guests"** workspace.
   - Net: ~20 destinations → **~8**.
4. **Behind advanced mode?** Signals, Events, Experiments, Audience, raw Funnels, Changelog.
   Hidden by default; a single "Advanced" toggle in nav reveals them.
5. **Ideal workflow (login → action, ~30s):**
   `Login → Home → read Top 3 Opportunities + Business Health → click an opportunity →
   act (Promotions/Experience) OR tap "Why?" to drill into Menu Analysis → done.`
   The owner never needs to hunt across 10 screens.

---

## 3. Proposed information architecture (navigation)

Replace the flat ~20-item list with **5 labelled groups**, Advanced collapsed:

```
🏠 HOME                     ← primary destination

ACT (decide & configure)
  • Opportunities           ← "what should I do today?"
  • Promotions
  • Experience
  • Sales

UNDERSTAND (why)
  • Menu Analysis           (= Optimize + Menu Engineering + Heatmap, tabbed)
  • Guests                  (= Tables + Journeys)
  • Analytics               (= overview + funnels + pairings, tabbed)

SETUP
  • Composer · Import · QR · Print · Kiosk

⚙︎ Advanced (collapsed)
  • Data Health (Signals + Events) · Experiments · Audience · Changelog
```

Grouping alone — before any merging — removes most of the overwhelm.

---

## 4. The Home Dashboard (the consolidation)

The primary destination. Six widgets, each a *summary that links to its deep screen*:

1. **Top Opportunities** — top 3 from the Opportunity Board (type + action + confidence).
2. **Business Health** — one headline (e.g. conversion or revenue) + 7-day trend arrow.
3. **Menu Performance** — best & weakest item (from menu-engineering); link to Menu Analysis.
4. **Traffic Trends** — views-by-day sparkline.
5. **Promotion Status** — what's live now / scheduled next (from Promotions).
6. **Recent Changes** — last few owner actions / shipped changes (closes the optimization loop:
   "you moved Garden Spritz up 3 days ago → opens +X").

Everything else *supports* this screen. Health/trends reuse existing analytics APIs; Top
Opportunities reuses `/api/analytics/opportunities`; nothing new to compute — it's composition.

---

## 5. Recommended next steps (in order)

> **Status (2026-06-07): COMPLETE.** ✅ Closed Loop v1 · ✅ Home Dashboard (`/admin/home`) ·
> ✅ Nav consolidation (grouped "More", Advanced hidden, CRM removed) · ✅ Menu Analysis
> workspace (Optimize+Menu Eng+Heatmap, tabs) · ✅ Guests workspace (Tables+Journeys, tabs).
> Standalone routes kept as deep links. The owner journey: Home → Opportunities → act, or
> drill into Menu Analysis for "why".


1. **Nav restructure** into the 5 groups + Advanced toggle. *Small, high-impact, low-risk.*
2. **Build the Home Dashboard** as `/admin` landing; retire Executive into it.
3. **Tab-merge** the diagnostic screens (Menu Analysis, Guests, Analytics) — only after Home lands.
4. *Then, and only then*, consider new recommendation types.

**Not doing now:** more opportunity/recommendation types, more standalone dashboards.

---

## 6. Open questions for review

- Is "Menu Analysis = Optimize + Menu Engineering + Heatmap (tabbed)" the right grouping, or
  should Optimize stay fully standalone next to Opportunities?
- Should the Home Dashboard be the diner-owner's only required screen (everything else optional)?
- Do we need role tiers (owner vs manager vs analyst) driving which groups show?
- Is an "Advanced mode" toggle enough, or should advanced screens be a separate URL space?

---

## 7. Decisions locked (after owner review, 2026-06-07)

- **Home Dashboard is the single required screen.** Official product goal: the owner understands
  *what works · what doesn't · what to do · what changed* in **<20 seconds**. If they must open
  Opportunities + Analytics + Optimize + Heatmap + Tables + Journeys to understand the restaurant,
  we failed.
- **Positioning: "Menu Optimization", not "Menu Intelligence."** Owners buy *More Revenue* +
  *Better Menu Decisions*, not "intelligence." (Rename product framing accordingly.)
- **Merges confirmed:** **Menu Analysis** = Optimize + Menu Engineering + Heatmap (one tabbed
  workspace — "why does this drink behave this way?"). **Guests** = Tables + Journeys (one
  workspace — "who were the guests?"). Opportunities and Optimize stay separate (doctor vs MRI).
- **Analytics gains a Traffic Sources tab** (`table_qr` / `whatsapp` / `instagram` / `direct`).
- **Advanced mode — hard rule: the owner NEVER sees Advanced by default.**
- **Audience / CRM: hidden completely** (not even Advanced) until there's a stable `visitor_id`,
  real returning users, and real segmentation. Until then it's a distraction.
- **Impact Tracker** added as the **7th Home widget**.

## 8. Closed Loop Optimization — THE next priority (before any new feature)

The missing layer: **Recommendation → Action → Measured Result → Status.** This is what turns the
product from Analytics into Optimization (the part restaurants pay monthly for).

**Change Attribution — how we know "an action was taken":**
- **Auto-captured** (zero owner effort): promotion created/activated, experience/badge change,
  price change (via promotion) — the platform timestamps these when the owner makes them.
- **Manual change log** (for off-platform actions we can't see): "moved Garden Spritz higher",
  "new image for Negroni" — the owner records it with a date + item. (Drag-to-reorder isn't an
  in-app feature yet, so position changes are attributed manually until it is.)

**Measurement (integrity-gated):** for a change at time `T` on item `X` watching metric `M`,
compare `M` per-day in `[T−W, T]` vs `[T, T+W]` (W ≈ 7d). Report a delta only when both windows
have enough sample; otherwise the status is "Too early" / "Need more data" — **never a fabricated
number.** Status ∈ { Success · Declined · No clear effect · Too early · Insufficient data }.

**Surfaces:**
- A dedicated **Closed Loop** screen: Recommendation → Action → Result → Status.
- The **Impact Tracker** widget on Home ("3 days ago you moved Garden Spritz higher → views +28%").

**Build:** measurement engine `src/lib/closedloop` (pure, tested) · `changes` table (migration
`0010`) · auto-capture in the Promotions + Experience APIs · manual-change API · Closed Loop screen.
Only after this do we build the Home Dashboard (Impact Tracker lives on it) and the nav merges.
