import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { removeBackground } from '@imgly/background-removal-node';
import { SHARED_LAYERS, type LayerConfig } from '@/data/cocktail';
import { requireSession, unauthorized } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface GenerateBreakdownBody {
  slug: string;
  name: string;
  tagline?: string;
  category?: string;
}

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

function customizePrompt(layer: LayerConfig, body: GenerateBreakdownBody): string {
  const context = [
    `CONTEXT: This element is one layer of a cocktail called "${body.name}"`,
    body.tagline ? `(${body.tagline})` : '',
    body.category ? `Category: ${body.category}.` : '',
    'Adapt color, garnish and mood to fit this cocktail.',
  ]
    .filter(Boolean)
    .join(' ');
  return `${layer.generationPrompt} ${context}`;
}

interface StreamEvent {
  event: 'start' | 'layer-start' | 'layer-done' | 'layer-error' | 'complete' | 'error';
  index?: number;
  id?: string;
  total?: number;
  image?: string;
  message?: string;
  layers?: LayerConfig[];
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireSession();
  } catch (error: unknown) {
    return unauthorized(error);
  }

  let body: GenerateBreakdownBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.slug || !body.name) {
    return new Response(JSON.stringify({ error: 'slug and name are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const outputDir = path.join(process.cwd(), 'public', 'cocktail', 'drafts');
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'mkdir failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      send({ event: 'start', total: SHARED_LAYERS.length });

      const generatedLayers: LayerConfig[] = [];

      for (let i = 0; i < SHARED_LAYERS.length; i++) {
        const template = SHARED_LAYERS[i]!;
        send({ event: 'layer-start', index: i, id: template.id });

        const seed = Date.now() + i * 137;
        const prompt = customizePrompt(template, body);
        const pollinationsUrl = buildPollinationsUrl(prompt, seed);

        try {
          const response = await fetch(pollinationsUrl);
          if (!response.ok) {
            throw new Error(`Pollinations HTTP ${response.status}`);
          }
          const rawBuffer = Buffer.from(await response.arrayBuffer());

          const rawBlob = new Blob([new Uint8Array(rawBuffer)], { type: 'image/png' });
          const transparentBlob = await removeBackground(rawBlob);
          const transparentBuffer = Buffer.from(await transparentBlob.arrayBuffer());

          const filename = `${body.slug}-${template.id}.png`;
          const filepath = path.join(outputDir, filename);
          await fs.writeFile(filepath, transparentBuffer);

          const newLayer: LayerConfig = {
            ...template,
            image: `/cocktail/drafts/${filename}`,
          };
          generatedLayers.push(newLayer);
          send({ event: 'layer-done', index: i, id: template.id, image: newLayer.image });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          generatedLayers.push(template);
          send({ event: 'layer-error', index: i, id: template.id, message });
        }
      }

      send({ event: 'complete', layers: generatedLayers });
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
