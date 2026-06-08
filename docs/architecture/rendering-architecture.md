# Rendering Architecture

How the visual surfaces are built: the 3D breakdown, AR, kiosk, and the
responsive layout strategy.

## Surfaces

| Route | Surface | Notes |
|-------|---------|-------|
| `/` | Menu grid | `MenuCard` (CSS-3D tilt), no WebGL |
| `/cocktails/[slug]` | `CocktailScene` | R3F canvas + ingredient labels |
| `/drafts/[slug]` | `CocktailScene` | same component, draft data |
| `/kiosk` | `CocktailScene` (looping) | immersive, no chrome |
| `/ar/[slug]` | Camera + DOM overlay | `getUserMedia`, drag/pinch hero |

## CocktailScene — the 3-zone layout (xl+)

```
┌ Title ───────────────────────────────────── Actions ┐
│ ┌ Left ──┐   ┌ Center (flex-1) ──────┐   ┌ Right ──┐ │
│ │ flavor │   │  R3F Canvas (layers)  │   │  hero   │ │
│ │ note   │   │  + IngredientLabels   │   │  photo  │ │
│ └────────┘   └───────────────────────┘   └─────────┘ │
└──────────────────────────────────────────────────────┘
```

- **Center column owns the canvas AND the labels.** Labels anchor at
  `50% + 5rem` of the *center column* (not the viewport), so they track the
  layers automatically when the column resizes.
- Below `xl`, the side columns collapse: the center goes full-width (canvas
  full-screen, labels at viewport center), and a bottom-left flavor panel
  returns — preserving the original mobile experience.

### R3F canvas sizing gotcha

The canvas must be `position: absolute; inset: 0` inside a `relative flex-1`
column. R3F measures its container via ResizeObserver on mount; in some
headless/preview environments the initial observation doesn't fire until a
`resize` event, leaving the canvas at its 300×150 default. Real browsers fire
it on mount, so production is fine — but be aware when testing in tooling.

## Resilience

The canvas is wrapped in `<ErrorBoundary label="cocktail-canvas">` with a
fallback that renders the static hero image (`mix-blend-screen` so the black
background dissolves). A WebGL/driver crash degrades gracefully instead of
blanking the page.

## Known performance debt (not yet addressed)

These are tracked for the "mobile hardening" phase:

1. **WebGL cleanup** — verify geometry/material/texture/renderer `.dispose()`
   on unmount and on cocktail change, to avoid leaks across navigation.
2. **Lazy canvas mount** — gate the R3F canvas behind an IntersectionObserver
   and `prefers-reduced-motion`, instead of mounting eagerly.
3. **Image optimization** — `MenuCard` and the hero photo use raw `<img>`;
   migrate to `next/image` for responsive sizes + lazy loading on mobile.
4. **Kiosk loop** — confirm textures from previous cocktails are released
   between loop iterations.

## AR

`/ar/[slug]` uses `getUserMedia` for the camera feed and a DOM-positioned hero
image with pointer-based drag + pinch-zoom and a capture-to-PNG. Today a denied
or absent camera shows "Requested device not found" — graceful fallback UX
(retry, static-preview mode, branded capture frames for sharing) is planned for
the AR-virality phase.
