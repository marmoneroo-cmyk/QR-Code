/**
 * CLI version of /api/generate-breakdown.
 *
 * Usage: npm run generate:breakdown <slug>
 *
 * Iterates over the cocktail's own `layers` (post-makeCustomLayers) so per-slot
 * prompt overrides defined in cocktail.ts are honored. Each layer's
 * generationPrompt is used as-is — already cocktail-specific.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { removeBackground } from '@imgly/background-removal-node';
import { MENU, type CocktailConfig, type LayerConfig } from '../src/data/cocktail';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'cocktail', 'drafts');

function buildPollinationsUrl(prompt: string, seed: number): string {
  const params = new URLSearchParams({
    width: '1024',
    height: '1024',
    seed: String(seed),
    model: 'flux',
    nologo: 'true',
    enhance: 'true',
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

async function generateLayer(
  layer: LayerConfig,
  cocktail: CocktailConfig,
  index: number
): Promise<LayerConfig> {
  const prompt = layer.generationPrompt;
  const seed = Date.now() + index * 137;
  const url = buildPollinationsUrl(prompt, seed);

  console.log(`  [${layer.id}] generating…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
  const rawBuffer = Buffer.from(await res.arrayBuffer());

  console.log(`  [${layer.id}] removing background…`);
  const rawBlob = new Blob([new Uint8Array(rawBuffer)], { type: 'image/png' });
  const transparentBlob = await removeBackground(rawBlob);
  const transparentBuffer = Buffer.from(await transparentBlob.arrayBuffer());

  const filename = `${cocktail.slug}-${layer.id}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);
  await fs.writeFile(filepath, transparentBuffer);
  const imagePath = `/cocktail/drafts/${filename}`;
  console.log(`  [${layer.id}] saved → ${imagePath}`);

  return { ...layer, image: imagePath };
}

async function main(): Promise<void> {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npm run generate:breakdown <slug>');
    console.error('Available slugs:');
    for (const c of MENU) console.error(`  ${c.slug}`);
    process.exit(1);
  }

  const cocktail = MENU.find((c) => c.slug === slug);
  if (!cocktail) {
    console.error(`No cocktail with slug "${slug}".`);
    process.exit(1);
  }

  // Optional layer-id filter: `npm run generate:breakdown -- <slug> glass splash_pink`
  const onlyIds = process.argv.slice(3);
  const targets =
    onlyIds.length > 0
      ? cocktail.layers.filter((l) => onlyIds.includes(l.id))
      : cocktail.layers;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Generating ${targets.length} layer(s) for "${cocktail.title.en}" (${cocktail.slug})\n`);

  for (let i = 0; i < targets.length; i++) {
    const layer = targets[i]!;
    console.log(`\n[${i + 1}/${targets.length}] Layer: ${layer.id}`);
    try {
      await generateLayer(layer, cocktail, i);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [${layer.id}] FAILED: ${msg}`);
    }
  }

  console.log('\n✓ Done.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
