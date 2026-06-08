/**
 * Turntable agent — generates a 360° frame sequence from ONE reference glass
 * photo using OpenAI's image model (gpt-image-1), and saves each frame as a
 * full-resolution PNG into public/cocktail/spin/<slug>/<i>.png.
 *
 * Usage:
 *   1. Put your key in .env.local:   OPENAI_API_KEY=sk-...
 *   2. npm run generate:spin:openai -- "<glass.png>" <slug> [frames]
 *      e.g. npm run generate:spin:openai -- "C:/.../garden.png" garden-spritz 24
 *
 * Each angle is a SEPARATE call (image edit with the reference image), so every
 * frame comes back at full 1024x1536 — sharp, unlike a packed contact sheet.
 * Caveat: separate generations vary slightly, so the turntable can "jitter".
 * Cost: ~$0.04–0.17 per image × frames (gpt-image-1 pricing).
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

dotenv.config({ path: '.env.local' });

const API_URL = 'https://api.openai.com/v1/images/edits';
const SIZE = '1024x1536'; // portrait, full resolution per frame

async function main(): Promise<void> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('Missing OPENAI_API_KEY. Add it to .env.local:');
    console.error('  OPENAI_API_KEY=sk-...');
    console.error('Get one at https://platform.openai.com/api-keys');
    process.exit(1);
  }

  const src = process.argv[2];
  const slug = process.argv[3];
  const frames = Number(process.argv[4] ?? 24);
  if (!src || !slug) {
    console.error('Usage: npm run generate:spin:openai -- "<glass.png>" <slug> [frames]');
    process.exit(1);
  }

  const imageBuf = await fs.readFile(src);
  const outDir = path.join(process.cwd(), 'public', 'cocktail', 'spin', slug);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Generating ${frames} turntable frames for "${slug}" via gpt-image-1\n`);

  for (let i = 0; i < frames; i++) {
    const angle = Math.round((i * 360) / frames);
    const prompt =
      `Studio product photograph of EXACTLY this same cocktail — identical glass, ` +
      `liquid colour, ice and garnish — rotated ${angle} degrees on a turntable so it is ` +
      `seen from that new angle. Keep identical lighting, scale and centered composition, ` +
      `single subject on a pure black background, photorealistic, sharp focus.`;

    try {
      const form = new FormData();
      form.append('model', 'gpt-image-1');
      form.append('image', new Blob([new Uint8Array(imageBuf)], { type: 'image/png' }), 'glass.png');
      form.append('prompt', prompt);
      form.append('size', SIZE);
      form.append('n', '1');

      console.log(`  [${i + 1}/${frames}] angle ${angle}°…`);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image in response');
      await fs.writeFile(path.join(outDir, `${i}.png`), Buffer.from(b64, 'base64'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [${i + 1}/${frames}] FAILED: ${msg}`);
    }
  }

  console.log(`\n✓ Done. ${frames} frames in /cocktail/spin/${slug}/  (remember to set SPIN_SHEETS["${slug}"] = ${frames})`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
