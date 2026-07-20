import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { removeBackground } from '@imgly/background-removal-node';
import { SHARED_LAYERS, type LayerConfig } from '@/data/cocktail';
import { requireSession, unauthorized } from '@/lib/auth/guard';
import { log } from '@/lib/log';
import { slugify } from '@/lib/heroPrompts';
import { readJsonCapped } from '@/lib/net/bounded';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BODY = 256_000;

/*
 * Pollinations is a free, best-effort service: it answers in ~45s under load and
 * intermittently returns 5xx. With a single attempt, one transient blip permanently
 * lost that layer and silently substituted the default — a whole 7-layer run could
 * fail end to end while every URL was perfectly valid. Retrying transient failures is
 * what actually makes generation work.
 *
 * Only 5xx and network/timeout errors are retried; a 4xx is a real rejection (bad
 * params, auth, quota) and retrying it just burns another 45 seconds.
 */
const FETCH_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 90_000;
const RETRY_BACKOFF_MS = [2_000, 5_000];

async function fetchImageWithRetry(url: string, layerId: string): Promise<Buffer> {
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return Buffer.from(await response.arrayBuffer());

      lastError = `Pollinations HTTP ${response.status}`;
      // A client error will not become valid on a retry — fail fast.
      if (response.status < 500) break;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }

    const backoff = RETRY_BACKOFF_MS[attempt - 1];
    if (attempt < FETCH_ATTEMPTS && backoff !== undefined) {
      log.warn('generate-breakdown', `${lastError} — retrying`, { layerId, attempt, of: FETCH_ATTEMPTS });
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw new Error(lastError);
}

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

  const parsed = await readJsonCapped<GenerateBreakdownBody>(req, MAX_BODY);
  if (!parsed.ok) {
    return parsed.reason === 'too_large'
      ? new Response(JSON.stringify({ success: false, error: 'payload too large' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        })
      : new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
  }
  const body = parsed.data;

  if (!body.slug || !body.name) {
    return new Response(JSON.stringify({ success: false, error: 'slug and name are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const outputDir = path.join(process.cwd(), 'public', 'cocktail', 'drafts');
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (err: unknown) {
    log.error('generate-breakdown', err instanceof Error ? err.message : 'mkdir failed', { stage: 'mkdir', dir: outputDir });
    return new Response(JSON.stringify({ success: false, error: 'internal error' }), {
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
          const rawBuffer = await fetchImageWithRetry(pollinationsUrl, template.id);

          const rawBlob = new Blob([new Uint8Array(rawBuffer)], { type: 'image/png' });
          const transparentBlob = await removeBackground(rawBlob);
          const transparentBuffer = Buffer.from(await transparentBlob.arrayBuffer());

          // Path-traversal guard: body.slug is user-controlled and flows into a filename.
          // slugify() strips everything outside [a-z0-9-], so `../../etc` can't escape outputDir.
          const filename = `${slugify(body.slug) || 'draft'}-${template.id}.png`;
          const filepath = path.join(outputDir, filename);
          await fs.writeFile(filepath, transparentBuffer);

          const newLayer: LayerConfig = {
            ...template,
            image: `/cocktail/drafts/${filename}`,
          };
          generatedLayers.push(newLayer);
          send({ event: 'layer-done', index: i, id: template.id, image: newLayer.image });
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.message : String(err);
          log.error('generate-breakdown', detail, { stage: 'layer', index: i, id: template.id });
          generatedLayers.push(template);
          /*
           * Say WHICH kind of failure this was. "layer generation failed" x7 told the
           * owner nothing and looked like a bug in their menu; an upstream outage is a
           * "try again shortly", which is a completely different action. The upstream
           * status is a public image service's, not internal detail worth hiding.
           */
          const isUpstream = /HTTP 5\d\d|abort|timeout|fetch failed|ENOTFOUND|ECONNRESET/i.test(detail);
          send({
            event: 'layer-error',
            index: i,
            id: template.id,
            message: isUpstream
              ? 'image service unavailable — try again shortly'
              : 'layer generation failed',
          });
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
