/**
 * Intrinsic pixel dimensions of the built-in /public hero art, so next/image can optimize
 * the drink/dish hero (AVIF/WebP + srcset) without layout shift — next/image needs a real
 * width/height, and these heroes have varying aspect ratios. Generated from the PNG headers.
 *
 * Anything NOT listed — operator uploads (data:/blob: heroes) or a newly-added drink whose
 * dimensions haven't been recorded — falls back to a plain <img>, so it still renders, just
 * un-optimized until added here.
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

export const HERO_DIMENSIONS: Record<string, ImageDimensions> = {
  '/cocktail/citrus-lime-sour-hero.png': { width: 1086, height: 1448 },
  '/cocktail/smoked-old-fashioned-hero.png': { width: 686, height: 858 },
  '/cocktail/garden-spritz-hero.png': { width: 686, height: 858 },
  '/cocktail/diner-aperol-spritz-hero.png': { width: 686, height: 858 },
  '/cocktail/diner-green-garden-hero.png': { width: 686, height: 858 },
  '/cocktail/diner-margarita-hero.png': { width: 686, height: 858 },
  '/cocktail/diner-negroni-hero.png': { width: 686, height: 858 },
  '/cocktail/diner-pinky-hero.png': { width: 686, height: 858 },
  '/cocktail/diner-whiskey-sour-hero.png': { width: 686, height: 858 },
  '/Food/truffle-burger-cut.png': { width: 1086, height: 1448 },
};

/** Intrinsic dimensions for a built-in hero path, or null for uploads / unlisted images. */
export function getHeroDimensions(src: string): ImageDimensions | null {
  return HERO_DIMENSIONS[src] ?? null;
}
