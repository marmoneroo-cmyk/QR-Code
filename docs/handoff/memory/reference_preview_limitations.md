---
name: reference-preview-limitations
description: The embedded browser runs pages as hidden so requestAnimationFrame never fires — the root cause behind the "can't drive framer" quirks, plus the verification traps that produce false bug reports
metadata:
  node_type: memory
  type: reference
  originSessionId: 863cfba6-3fbc-44be-a19e-ca0befc42724
---

**Root cause (measured 2026-07-20, every tab, fronted or not):** the Browser pane reports
`document.visibilityState === "hidden"`, so **`requestAnimationFrame` never fires**. That one
fact explains the older "framer can't be driven by synthetic clicks" note — React state DOES
toggle, but no rAF means no animation frame, so entering views never mount and exiting nodes
linger forever at `opacity: 0`.

Consequences:
- **The 3D exploded view, the ingredients panel and live AR cannot be verified here.** They
  need a real device. Screenshots of those pages also time out.
- **Any rAF-driven count-up freezes at its start value.** Do NOT dismiss this as noise: it was
  a REAL bug for anyone opening the admin in a background tab. `useCountUp` now renders the
  value immediately when `document.hidden` — see [[project_no_fabricated_numbers]].

Verification traps that each produced a FALSE bug report in one session:
- Matching controls by `textContent` when the label is in `aria-label` (flag/icon buttons,
  edit/delete). Always use `aria-label || textContent`.
- Comparing the wrong box edge in RTL — compare the START edge (`right` in RTL, `left` in LTR).
- `:focus-visible` does not apply to programmatic `.focus()`; press a real Tab key.
- `textContent` reads hidden elements, so `hidden md:block` content looks present. Check
  `getComputedStyle().display`.
- `document.body.click()` skips `pointerdown`/`mousedown`, so dismiss-on-outside-click looks broken.
- Setting `input.value` via the native setter does NOT update React state — the form still sees
  it empty. Read the source, or type for real, instead of trusting a scripted fill.
- `@media (pointer: coarse)` never matches; the pane reports a fine pointer, so 44px touch-target
  rules appear unapplied.
- Console messages persist across navigations, so a stale error from a since-fixed build reads as
  live. Open a NEW tab before believing one.
- A label may come from an A/B experiment variant, so grepping the literal string finds nothing.
- `input[type=text]` matches the ATTRIBUTE; a React input with no `type` attr has `.type === "text"`
  as a property but the selector returns null. Select by aria-label/placeholder instead.
- `navigator.clipboard.writeText` HANGS the pane forever (permission prompt never resolves) and
  can wedge the whole tab — never click copy-to-clipboard buttons here; verify their handler in code.
- Native `confirm()`/`alert()` also block the renderer — stub `window.confirm = () => true` BEFORE
  clicking a delete button, and avoid buttons whose failure path alerts.
- A loose error-regex can match page copy (e.g. "CSV" in instructions) or a field LABEL with a
  required asterisk instead of the error banner — anchor on the exact error string from the code.

Reliable here: element presence/text, computed styles, `getBoundingClientRect`, `naturalWidth>0`,
HTTP status via `fetch`, localStorage, network interception, and driving real API routes.

Rule: when a measurement disagrees with the code, suspect the measurement first — but keep
digging until the two agree, because sometimes the code really is wrong.
