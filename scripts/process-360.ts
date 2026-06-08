/**
 * 360° turntable processor — turns a contact-sheet into clean, UNIFORM frames
 * for the Spin360 viewer.
 *
 * Pipeline per cell:
 *   1. slice the grid cell (cols x rows)
 *   2. optionally mask top/bottom label strips (full-width black bars)
 *   3. trim the black background down to the glass (bounding box)
 *   4. composite every glass, centered, onto ONE shared canvas sized to the
 *      largest frame — so position + scale are identical across all frames
 *      ("ruler-precise"), eliminating wobble in the spin.
 *
 * Usage: npm run process:360 -- "<sheet>" <slug> <cols> <rows> [topMaskH] [bottomMaskH] [inset] [threshold] [pad]
 *   npm run process:360 -- "public/cocktail/360/sheet.png" diner-margarita 8 4
 *
 * Output: public/cocktail/spin/<slug>/<i>.png  (i = 0 … cols*rows-1)
 */

import sharp from 'sharp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function blackBar(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const src = process.argv[2];
  const slug = process.argv[3];
  const cols = Number(process.argv[4] ?? 0);
  const rows = Number(process.argv[5] ?? 0);
  const topMaskH = Number(process.argv[6] ?? 0);
  const bottomMaskH = Number(process.argv[7] ?? 0);
  const inset = Number(process.argv[8] ?? 2);
  const threshold = Number(process.argv[9] ?? 22);
  const pad = Number(process.argv[10] ?? 28);

  if (!src || !slug || !cols || !rows) {
    console.error('Usage: npm run process:360 -- "<sheet>" <slug> <cols> <rows> [topMaskH] [bottomMaskH] [inset] [threshold] [pad]');
    process.exit(1);
  }

  const meta = await sharp(src).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  const w = cellW - inset * 2;
  const h = cellH - inset * 2;

  const topBar = topMaskH > 0 ? await blackBar(w, topMaskH) : null;
  const botBar = bottomMaskH > 0 ? await blackBar(w, bottomMaskH) : null;

  // Pass 1 — slice, mask labels, trim each cell to the glass bounding box.
  const trimmed: Array<{ buf: Buffer; w: number; h: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const composites: sharp.OverlayOptions[] = [];
      if (topBar) composites.push({ input: topBar, top: 0, left: 0 });
      if (botBar) composites.push({ input: botBar, top: h - bottomMaskH, left: 0 });

      let cell = sharp(src).extract({ left: c * cellW + inset, top: r * cellH + inset, width: w, height: h });
      if (composites.length) cell = cell.composite(composites);
      const cellBuf = await cell.png().toBuffer();

      const trimmedBuf = await sharp(cellBuf)
        .trim({ background: '#000000', threshold })
        .png()
        .toBuffer();
      const tm = await sharp(trimmedBuf).metadata();
      trimmed.push({ buf: trimmedBuf, w: tm.width ?? w, h: tm.height ?? h });
    }
  }

  // Shared canvas = largest trimmed frame + padding, so every glass keeps its
  // native scale and is centered identically.
  const canvasW = Math.max(...trimmed.map((t) => t.w)) + pad * 2;
  const canvasH = Math.max(...trimmed.map((t) => t.h)) + pad * 2;

  const outDir = path.join(process.cwd(), 'public', 'cocktail', 'spin', slug);
  await fs.mkdir(outDir, { recursive: true });

  // Pass 2 — center each trimmed glass on the shared canvas.
  for (let i = 0; i < trimmed.length; i++) {
    const t = trimmed[i]!;
    const left = Math.round((canvasW - t.w) / 2);
    const top = Math.round((canvasH - t.h) / 2);
    await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .composite([{ input: t.buf, left, top }])
      .png()
      .toFile(path.join(outDir, `${i}.png`));
  }

  console.log(`Processed ${trimmed.length} uniform frames (${canvasW}x${canvasH}) → /cocktail/spin/${slug}/`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
