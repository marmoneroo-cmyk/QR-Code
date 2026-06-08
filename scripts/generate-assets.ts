import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { removeBackground } from '@imgly/background-removal-node';
import { CITRUS_LIME_SOUR, type LayerConfig } from '../src/data/cocktail';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'cocktail');
const WIDTH = 1024;
const HEIGHT = 1024;
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
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateLayer(layer: LayerConfig, index: number): Promise<void> {
  const filename = path.basename(layer.image);
  const filepath = path.join(OUTPUT_DIR, filename);

  const seed = 1000 + index * 137;
  const url = buildUrl(layer.generationPrompt, seed);

  console.log(`\n[${layer.id}] generating (seed=${seed})...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const rawBuffer = Buffer.from(await response.arrayBuffer());

  console.log(`[${layer.id}] removing background...`);
  const rawBlob = new Blob([new Uint8Array(rawBuffer)], { type: 'image/png' });
  const transparentBlob = await removeBackground(rawBlob);
  const transparentBuffer = await blobToBuffer(transparentBlob);

  await fs.writeFile(filepath, transparentBuffer);
  console.log(
    `[${layer.id}] saved ${filename} (${(transparentBuffer.length / 1024).toFixed(0)} KB)`
  );
}

async function main(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const onlyIds = process.argv.slice(2);
  const allLayers = CITRUS_LIME_SOUR.layers;
  const layers =
    onlyIds.length > 0 ? allLayers.filter((l) => onlyIds.includes(l.id)) : allLayers;

  if (onlyIds.length > 0 && layers.length === 0) {
    console.error(`No matching layers for: ${onlyIds.join(', ')}`);
    console.error(`Available: ${allLayers.map((l) => l.id).join(', ')}`);
    process.exit(1);
  }

  console.log(
    `Generating ${layers.length} of ${allLayers.length} assets via Pollinations (${MODEL}) + background removal`
  );

  for (const layer of layers) {
    const index = allLayers.indexOf(layer);
    const offset = onlyIds.length > 0 ? Date.now() % 1000 : 0;
    try {
      await generateLayer(layer, index + offset);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed for ${layer.id}: ${message}`);
    }
  }

  console.log('\nDone. Refresh the browser to see the new assets.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
