import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { removeBackground } from '@imgly/background-removal-node';
import { MENU } from '../src/data/cocktail';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'cocktail');
const WIDTH = 1024;
const HEIGHT = 1280;
const MODEL = 'flux';

function buildUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  const params = new URLSearchParams({
    width: String(WIDTH),
    height: String(HEIGHT),
    seed: String(seed),
    model: MODEL,
    nologo: 'true',
    enhance: 'true',
  });
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer());
}

async function main(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const onlySlugs = process.argv.slice(2);
  const cocktails = MENU.filter(
    (c) =>
      c.heroPrompt && (onlySlugs.length === 0 || onlySlugs.includes(c.slug))
  );

  if (cocktails.length === 0) {
    console.log('No cocktails with heroPrompt to generate.');
    return;
  }

  console.log(`Generating ${cocktails.length} hero images via Pollinations (${MODEL}) + background removal`);

  for (let i = 0; i < cocktails.length; i++) {
    const cocktail = cocktails[i]!;
    const filename = path.basename(cocktail.heroImage);
    const filepath = path.join(OUTPUT_DIR, filename);
    const seed = 5000 + i * 313 + cocktail.slug.length;

    try {
      console.log(`\n[${cocktail.slug}] generating hero (seed=${seed})...`);
      const url = buildUrl(cocktail.heroPrompt!, seed);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const rawBuffer = Buffer.from(await response.arrayBuffer());

      console.log(`[${cocktail.slug}] removing background...`);
      const rawBlob = new Blob([new Uint8Array(rawBuffer)], { type: 'image/png' });
      const transparentBlob = await removeBackground(rawBlob);
      const transparentBuffer = await blobToBuffer(transparentBlob);

      await fs.writeFile(filepath, transparentBuffer);
      console.log(
        `[${cocktail.slug}] saved ${filename} (${(transparentBuffer.length / 1024).toFixed(0)} KB)`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed for ${cocktail.slug}: ${msg}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
