import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { SHARED_LAYERS, type Category, type CocktailConfig } from '@/data/cocktail';
import { inferKind } from '@/lib/menu/classify';
import { requireSession, unauthorized } from '@/lib/auth/guard';
import { log } from '@/lib/log';

export const runtime = 'nodejs';
// Vercel Hobby plan caps serverless maxDuration at 300s. Bulk imports that
// need longer should be chunked client-side (one item per request).
export const maxDuration = 300;

/**
 * On serverless (Vercel) the filesystem is READ-ONLY — writing under
 * public/ throws EROFS and files written to /tmp aren't web-served anyway.
 * There we return the hero as an inline data URL (the drafts store keeps it
 * in localStorage); locally we keep writing real files to public/drafts.
 */
const IS_SERVERLESS = Boolean(process.env.VERCEL);

interface ItemInput {
  name: string;
  desc?: string | null;
  price?: string | null;
  /** The restaurant's own menu section — drives drink/food detection + course. */
  sourceCategory?: string | null;
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

// Neutral wording — imports can be food OR drinks (pasta is not "a cocktail").
/** Parse a scraped price string ("96", "96/120", "₪54") to a positive number. */
function parseImportedPrice(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const m = String(raw).match(/\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function buildHeroPrompt(name: string, desc: string | null | undefined): string {
  const detail = desc?.trim();
  const baseDesc = detail
    ? `made of: ${detail}`
    : 'elegantly presented';
  return `A beautifully lit restaurant menu item called "${name}", ${baseDesc}, fine-dining plating with elegant garnish, served against pure pitch black background with no surface or shadow below, ${STYLE_SUFFIX}`;
}

/**
 * Elegant inline placeholder when no image could be generated: a dark luxury
 * card with the item's initial and name in gold serif — fits food and drinks
 * alike (an empty cocktail glass on a pasta dish looked absurd).
 */
function placeholderHero(name: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const trimmed = name.trim();
  const initial = esc(trimmed.charAt(0).toUpperCase() || '·');
  const label = esc(trimmed.length > 24 ? `${trimmed.slice(0, 23)}…` : trimmed);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="832" height="1040" viewBox="0 0 832 1040">` +
    `<rect width="832" height="1040" fill="#09090b"/>` +
    `<rect x="26" y="26" width="780" height="988" fill="none" stroke="#fbbf24" stroke-opacity="0.22" stroke-width="2"/>` +
    `<circle cx="416" cy="450" r="160" fill="none" stroke="#fbbf24" stroke-opacity="0.35" stroke-width="2"/>` +
    `<text x="416" y="505" font-family="Georgia, 'Times New Roman', serif" font-size="160" fill="#fde68a" text-anchor="middle">${initial}</text>` +
    `<text x="416" y="700" font-family="Georgia, 'Times New Roman', serif" font-size="42" fill="#ffffff" fill-opacity="0.6" text-anchor="middle">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

// Default to `turbo` — a free-tier ("Seed") model. `flux` is an "advanced"
// model behind Pollinations' paid Flower tier (returns 402 otherwise). Override
// with POLLINATIONS_MODEL if you upgrade.
const POLLINATIONS_MODEL = process.env.POLLINATIONS_MODEL || 'turbo';

/** Server-only secret first; NEXT_PUBLIC_ kept only for back-compat. */
function pollinationsToken(): string | undefined {
  // Server-only secret — do NOT fall back to the NEXT_PUBLIC_ variant, which would be
  // bundled into client JS and hand the bearer token to anyone who views source.
  return process.env.POLLINATIONS_TOKEN;
}

function buildPollinationsUrl(prompt: string, seed: number): string {
  const params = new URLSearchParams({
    // Smaller on serverless: the hero travels as an inline data URL into the
    // client's localStorage drafts, so keep it lean there.
    width: IS_SERVERLESS ? '832' : '1024',
    height: IS_SERVERLESS ? '1040' : '1280',
    seed: String(seed),
    model: POLLINATIONS_MODEL,
    nologo: 'true',
    enhance: 'true',
  });
  // NOTE: the token is sent server-side as an Authorization: Bearer header
  // (the documented, authenticated method) — NOT a ?token= query param, which
  // a browser can't send and which falls back to anonymous per-IP rate limits.
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

/**
 * Background removal is BEST-EFFORT: the model package is heavy and may be
 * unavailable on serverless. Lazy-imported so a load failure can never 500 the
 * whole route — on any failure the raw (opaque) image is used instead.
 */
async function tryRemoveBackground(raw: Buffer): Promise<Buffer> {
  try {
    const { removeBackground } = await import('@imgly/background-removal-node');
    const rawBlob = new Blob([new Uint8Array(raw)], { type: 'image/png' });
    const transparentBlob = await removeBackground(rawBlob);
    return Buffer.from(await transparentBlob.arrayBuffer());
  } catch {
    return raw;
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireSession();
  } catch (error: unknown) {
    return unauthorized(error);
  }

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.restaurantSlug || !body.restaurantName || !Array.isArray(body.items)) {
    return new Response(
      JSON.stringify({ success: false, error: 'restaurantSlug, restaurantName, items are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const restaurantSlug = slugify(body.restaurantSlug);
  const outputDir = path.join(process.cwd(), 'public', 'cocktail', 'drafts');
  if (!IS_SERVERLESS) {
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch {
      // Read-only FS (e.g. an unexpected serverless host) — fall back to
      // inline data URLs below instead of failing the whole request.
    }
  }

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

          // IMAGE IS OPTIONAL: menu import must succeed even when the image
          // service is down/unfunded (Pollinations 402/403 without a token).
          // On failure the item imports with a placeholder and the owner adds
          // a photo in the editor (manual upload already supported there).
          let heroImage = placeholderHero(item.name);
          let imageNote: string | undefined;
          try {
            const token = pollinationsToken();
            const response = await fetch(pollinationsUrl, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (!response.ok) {
              throw new Error(`Pollinations HTTP ${response.status}`);
            }
            const rawBuffer = Buffer.from(await response.arrayBuffer());
            const heroBuffer = await tryRemoveBackground(rawBuffer);

            const filename = `${itemSlug}-hero.png`;
            if (IS_SERVERLESS) {
              // No writable, web-served disk here — inline the image instead.
              heroImage = `data:image/png;base64,${heroBuffer.toString('base64')}`;
            } else {
              try {
                await fs.writeFile(path.join(outputDir, filename), heroBuffer);
                heroImage = `/cocktail/drafts/${filename}`;
              } catch {
                heroImage = `data:image/png;base64,${heroBuffer.toString('base64')}`;
              }
            }
          } catch (imgErr: unknown) {
            const why = imgErr instanceof Error ? imgErr.message : String(imgErr);
            log.error('import-restaurant', 'image generation failed', { error: why });
            imageNote = `image unavailable (${why}) — add a photo in the editor`;
          }

          const draft: CocktailConfig = {
            slug: itemSlug,
            title: { en: item.name, he: item.name },
            subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
            tagline: item.desc
              ? { en: item.desc, he: item.desc }
              : undefined,
            category: item.category ?? 'citrus',
            kind: inferKind(item.name, item.sourceCategory),
            course: item.sourceCategory ?? undefined,
            priceILS: parseImportedPrice(item.price),
            heroImage,
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
          send({ event: 'item-done', index: i, name: item.name, draft, message: imageNote });
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
