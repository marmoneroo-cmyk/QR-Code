import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { removeBackground } from '@imgly/background-removal-node';
import { SHARED_LAYERS, type Category, type CocktailConfig } from '@/data/cocktail';

export const runtime = 'nodejs';
// Vercel Hobby plan caps serverless maxDuration at 300s. Bulk imports that
// need longer should be chunked client-side (one item per request).
export const maxDuration = 300;

interface ItemInput {
  name: string;
  desc?: string | null;
  category?: Category;
}

interface ImportBody {
  restaurantSlug: string;
  restaurantName: string;
  items: ItemInput[];
}

interface StreamEvent {
  event: 'start' | 'item-start' | 'item-done' | 'item-error' | 'complete' | 'error';
  index?: number;
  name?: string;
  total?: number;
  draft?: CocktailConfig;
  drafts?: CocktailConfig[];
  message?: string;
}

const STYLE_SUFFIX =
  'cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, photorealistic, 8k';

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9֐-׿\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'untitled'
  );
}

function buildHeroPrompt(name: string, desc: string | null | undefined): string {
  const detail = desc?.trim();
  const baseDesc = detail
    ? `with the following components: ${detail}`
    : 'in a fitting cocktail glass';
  return `A beautifully lit cocktail called "${name}" ${baseDesc}, with elegant garnish, served against pure pitch black background with no surface or shadow below, ${STYLE_SUFFIX}`;
}

function buildPollinationsUrl(prompt: string, seed: number): string {
  const params = new URLSearchParams({
    width: '1024',
    height: '1280',
    seed: String(seed),
    model: 'flux',
    nologo: 'true',
    enhance: 'true',
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

export async function POST(req: Request): Promise<Response> {
  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.restaurantSlug || !body.restaurantName || !Array.isArray(body.items)) {
    return new Response(
      JSON.stringify({ error: 'restaurantSlug, restaurantName, items are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const restaurantSlug = slugify(body.restaurantSlug);
  const outputDir = path.join(process.cwd(), 'public', 'cocktail', 'drafts');
  await fs.mkdir(outputDir, { recursive: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      send({ event: 'start', total: body.items.length });

      const drafts: CocktailConfig[] = [];

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i]!;
        send({ event: 'item-start', index: i, name: item.name });

        try {
          const itemSlug = slugify(`${restaurantSlug}-${item.name}`);
          const prompt = buildHeroPrompt(item.name, item.desc);
          const seed = Date.now() + i * 211;
          const pollinationsUrl = buildPollinationsUrl(prompt, seed);

          const response = await fetch(pollinationsUrl);
          if (!response.ok) {
            throw new Error(`Pollinations HTTP ${response.status}`);
          }
          const rawBuffer = Buffer.from(await response.arrayBuffer());

          const rawBlob = new Blob([new Uint8Array(rawBuffer)], { type: 'image/png' });
          const transparentBlob = await removeBackground(rawBlob);
          const transparentBuffer = Buffer.from(await transparentBlob.arrayBuffer());

          const filename = `${itemSlug}-hero.png`;
          await fs.writeFile(path.join(outputDir, filename), transparentBuffer);

          const draft: CocktailConfig = {
            slug: itemSlug,
            title: { en: item.name, he: item.name },
            subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
            tagline: item.desc
              ? { en: item.desc, he: item.desc }
              : undefined,
            category: item.category ?? 'citrus',
            heroImage: `/cocktail/drafts/${filename}`,
            heroPrompt: prompt,
            flavor: { sweet: 2, bitter: 2, citrus: 2, smoky: 2, herbal: 2 },
            bartenderNote: {
              en: `Imported from ${body.restaurantName}.`,
              he: `יובא מ${body.restaurantName}.`,
            },
            bartenderName: body.restaurantName,
            dietary: { vegan: true, glutenFree: true, alcoholFree: false },
            layers: SHARED_LAYERS,
            labels: [],
          };

          drafts.push(draft);
          send({ event: 'item-done', index: i, name: item.name, draft });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          send({ event: 'item-error', index: i, name: item.name, message });
        }
      }

      send({ event: 'complete', drafts });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
