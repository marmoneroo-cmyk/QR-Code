/**
 * Generates a depth map for a single high-res hero image, locally and for free,
 * using Depth-Anything-V2 (ONNX) via transformers.js. The depth map powers the
 * WebGL depth-parallax viewer (DepthParallax.tsx) — real 3D feel from ONE sharp
 * image, perfectly consistent, no per-view cost.
 *
 * Usage: npm run generate:depth -- "<image.png>" <slug>
 *   npm run generate:depth -- "public/cocktail/1.png" diner-aperol-spritz
 *
 * Output: public/cocktail/depth/<slug>.png   (grayscale: white = near, black = far)
 */

import { pipeline } from '@huggingface/transformers';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function main(): Promise<void> {
  const src = process.argv[2];
  const slug = process.argv[3];
  if (!src || !slug) {
    console.error('Usage: npm run generate:depth -- "<image.png>" <slug>');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'public', 'cocktail', 'depth');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.png`);

  console.log('Loading Depth-Anything-V2 (first run downloads ~50MB, then cached)…');
  const estimator = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small');

  console.log(`Estimating depth for ${src}…`);
  const result = (await estimator(src)) as { depth: { save: (p: string) => Promise<void> } };
  await result.depth.save(outPath);

  console.log(`✓ Depth map saved → /cocktail/depth/${slug}.png`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
