/**
 * Slices a turntable contact-sheet (grid of angle frames) into individual
 * frames for the Spin360 viewer.
 *
 * Usage: npm run slice:spin -- "<sheet.png>" <slug> [cols] [rows] [topMaskH] [bottomMaskH] [inset]
 *   npm run slice:spin -- "C:/.../turntable.png" garden-spritz 12 2 44 64 2
 *
 * Each cell is extracted in full (the glass is never cropped). Angle / quadrant
 * labels are hidden by compositing full-width black bars over the top and
 * bottom strips of each cell (background is pure black, so the bars are
 * invisible; the glass sits between them). `inset` trims faint grid lines.
 * Frames are written left-to-right, top-to-bottom to
 * public/cocktail/spin/<slug>/<i>.png.
 */

import sharp from 'sharp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function blackBar(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const src = process.argv[2];
  const slug = process.argv[3];
  const cols = Number(process.argv[4] ?? 4);
  const rows = Number(process.argv[5] ?? 2);
  const topMaskH = Number(process.argv[6] ?? 0);
  const bottomMaskH = Number(process.argv[7] ?? 0);
  const inset = Number(process.argv[8] ?? 0);

  if (!src || !slug) {
    console.error('Usage: npm run slice:spin -- "<sheet.png>" <slug> [cols] [rows] [topMaskH] [bottomMaskH] [inset]');
    process.exit(1);
  }

  const meta = await sharp(src).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  const w = cellW - inset * 2;
  const h = cellH - inset * 2;

  const outDir = path.join(process.cwd(), 'public', 'cocktail', 'spin', slug);
  await fs.mkdir(outDir, { recursive: true });

  const topBar = topMaskH > 0 ? await blackBar(w, topMaskH) : null;
  const botBar = bottomMaskH > 0 ? await blackBar(w, bottomMaskH) : null;

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = c * cellW + inset;
      const top = r * cellH + inset;
      const composites: sharp.OverlayOptions[] = [];
      if (topBar) composites.push({ input: topBar, top: 0, left: 0 });
      if (botBar) composites.push({ input: botBar, top: h - bottomMaskH, left: 0 });

      let pipeline = sharp(src).extract({ left, top, width: w, height: h });
      if (composites.length) pipeline = pipeline.composite(composites);
      await pipeline.png().toFile(path.join(outDir, `${idx}.png`));
      idx += 1;
    }
  }

  console.log(`Sliced ${idx} frames (${w}x${h}) → /cocktail/spin/${slug}/`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
