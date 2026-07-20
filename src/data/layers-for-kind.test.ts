import { describe, expect, it } from 'vitest';
import { DISH_LAYERS, SHARED_LAYERS, hasLayerImage, layersForKind } from './cocktail';

describe('hasLayerImage', () => {
  it('reports every dish layer as un-generated until its art exists', () => {
    // There is no stock plate art. Reusing the cocktail PNGs put a GLASS where a
    // dish's plate belongs, so these ship blank and renderers skip them.
    expect(DISH_LAYERS.every((l) => !hasLayerImage(l))).toBe(true);
  });

  it('reports every drink layer as present — their template art is real', () => {
    expect(SHARED_LAYERS.every(hasLayerImage)).toBe(true);
  });

  it('treats a whitespace-only image as absent', () => {
    expect(hasLayerImage({ ...SHARED_LAYERS[0]!, image: '   ' })).toBe(false);
  });

  it('reports a generated draft image as present', () => {
    expect(hasLayerImage({ ...DISH_LAYERS[0]!, image: '/cocktail/drafts/x-plate.png' })).toBe(true);
  });

  // Mirrors the filter CocktailScene applies before handing layers to the 3D
  // viewer. Pinned here because that scene needs requestAnimationFrame and so
  // cannot be exercised in the headless preview.
  const renderable = (layers: typeof DISH_LAYERS, labelledIds: readonly string[]) =>
    layers.filter((l) => labelledIds.includes(l.id)).filter(hasLayerImage);

  it('renders nothing for a dish whose layers were never generated', () => {
    // The bug this replaces: these fell back to the cocktail PNGs, so a plated
    // dish showed a GLASS. Skipping beats substituting someone else's art.
    const ids = DISH_LAYERS.map((l) => l.id);
    expect(renderable(DISH_LAYERS, ids)).toEqual([]);
  });

  it('renders only the layers that came back when generation partly succeeded', () => {
    const partly = DISH_LAYERS.map((l) =>
      l.id === 'main' || l.id === 'sauce' ? { ...l, image: `/cocktail/drafts/d-${l.id}.png` } : l
    );

    expect(renderable(partly, partly.map((l) => l.id)).map((l) => l.id)).toEqual(['sauce', 'main']);
  });

  it('still renders every drink layer — nothing about drinks changed', () => {
    const ids = SHARED_LAYERS.map((l) => l.id);
    expect(renderable(SHARED_LAYERS, ids)).toHaveLength(SHARED_LAYERS.length);
  });
});

describe('layersForKind', () => {
  it('gives a dish the plated template, not the cocktail one', () => {
    expect(layersForKind('food')).toBe(DISH_LAYERS);
    expect(layersForKind('food').map((l) => l.id)).toContain('plate');
    expect(layersForKind('food').map((l) => l.id)).not.toContain('glass');
  });

  it('gives a drink the cocktail template', () => {
    expect(layersForKind('drink')).toBe(SHARED_LAYERS);
  });

  it('falls back to the cocktail template when kind is absent', () => {
    // Code-defined cocktails carry no `kind`; they must keep their glass/ice layers.
    expect(layersForKind(undefined)).toBe(SHARED_LAYERS);
  });

  it('keeps both templates on the same geometry so the 3D viewer is shared', () => {
    // The exploded view, parallax and label positions are tuned against these
    // numbers — a dish must explode with the same choreography as a drink.
    //
    // Compared as a SET, not index-by-index: the viewer keys layers by id into a
    // Map, so array order carries no meaning, and the two templates are ordered
    // differently on purpose (DISH_LAYERS reads bottom-up, plate to herbs).
    const geometry = (layers: typeof SHARED_LAYERS) =>
      layers
        .map((l) => `${l.y}|${l.z}|${l.scale}`)
        .sort();

    expect(DISH_LAYERS).toHaveLength(SHARED_LAYERS.length);
    expect(geometry(DISH_LAYERS)).toEqual(geometry(SHARED_LAYERS));
  });

  it('orders the dish layers bottom-up, plate first and herbs last', () => {
    expect(DISH_LAYERS[0]!.id).toBe('plate');
    expect(DISH_LAYERS.at(-1)!.id).toBe('herbs');
    const ys = DISH_LAYERS.map((l) => l.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('gives every dish layer a distinct id and a prompt', () => {
    const ids = DISH_LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const layer of DISH_LAYERS) {
      expect(layer.generationPrompt.length).toBeGreaterThan(0);
    }
  });
});
