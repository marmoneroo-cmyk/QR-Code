/**
 * Generates a 360° turntable frame sequence for a cocktail using Pollinations
 * (Flux). Each frame describes the same drink rotated by an incremental angle.
 *
 * Usage: npm run generate:spin -- <slug> [frames]
 *   npm run generate:spin -- diner-pinky 16
 *
 * NOTE: Flux is text-to-image, so frames will not be pixel-perfect siblings —
 * expect some "jitter". A fixed seed + explicit angle keeps them as close as
 * the model allows. Frames are saved (with their black void background intact,
 * no transparency) to public/cocktail/spin/<slug>/<i>.png.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { MENU } from '../src/data/cocktail';

const DEFAULT_FRAMES = 16;
const SEED = 4242; // fixed so every frame shares the same base composition

function buildUrl(prompt: string, seed: number): string {
  const params = new URLSearchParams({
    width: '768',
    height: '1024',
    seed: String(seed),
    model: 'flux',
    nologo: 'true',
    enhance: 'true',
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

function basePrompt(slug: string): string {
  const cocktail = MENU.find((c) => c.slug === slug);
  if (!cocktail) {
    console.error(`No cocktail with slug "${slug}". Available:`);
    for (const c of MENU) console.error(`  ${c.slug}`);
    process.exit(1);
  }
  if (cocktail.heroPrompt) return cocktail.heroPrompt;
  const tagline = cocktail.tagline?.en ?? '';
  return `A ${cocktail.title.en} cocktail, ${tagline}, in its serving glass with garnish, against pure black void, cinematic product photography, dramatic moody lighting, ultra-sharp focus, photorealistic, 8k`;
}

async function main(): Promise<void> {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npm run generate:spin -- <slug> [frames]');
    process.exit(1);
  }
  const frames = Number(process.argv[3]) || DEFAULT_FRAMES;
  const base = basePrompt(slug);

  const outDir = path.join(process.cwd(), 'public', 'cocktail', 'spin', slug);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Generating ${frames} turntable frames for "${slug}"\n`);

  for (let i = 0; i < frames; i++) {
    const angle = Math.round((i * 360) / frames);
    const prompt = `${base}, 360 degree turntable product photography, the exact same glass and drink and garnish rotated ${angle} degrees clockwise on a smooth turntable, identical lighting and composition, centered single subject`;
    const url = buildUrl(prompt, SEED);
    try {
      console.log(`  [${i + 1}/${frames}] angle ${angle}°…`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(path.join(outDir, `${i}.png`), buf);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [${i + 1}/${frames}] FAILED: ${msg}`);
    }
  }

  console.log(`\n✓ Done. ${frames} frames in /cocktail/spin/${slug}/`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
