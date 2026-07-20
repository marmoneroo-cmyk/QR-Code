import { describe, expect, it } from 'vitest';
import { DISH_LAYERS, SHARED_LAYERS, layersForKind } from './cocktail';

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
