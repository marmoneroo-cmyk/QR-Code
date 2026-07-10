import { ImageResponse } from 'next/og';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  CATEGORY_LABEL,
  FLAVOR_LABEL,
  findCocktailBySlug,
  type FlavorProfile,
  type Lang,
} from '@/data/cocktail';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 1500;
const FLAVOR_AXES: Array<keyof FlavorProfile> = ['sweet', 'bitter', 'citrus', 'smoky', 'herbal'];
// Public poster image — cached longer at the CDN edge than the JSON GETs since it's larger and changes rarely.
const POSTER_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } as const;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function loadImageAsDataUrl(publicPath: string): Promise<string | null> {
  try {
    const abs = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
    const buf = await fs.readFile(abs);
    const ext = publicPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    return `data:image/${ext};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Fetch only the glyphs we need from Google Fonts (so Hebrew renders). */
async function loadFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const m = css.match(/src: url\((https:[^)]+)\) format\('(truetype|opentype)'\)/);
    if (!m) return null;
    return await (await fetch(m[1]!)).arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  const { slug } = await context.params;
  const cocktail = findCocktailBySlug(slug);
  if (!cocktail) return new Response('Not found', { status: 404 });

  const langParam = new URL(req.url).searchParams.get('lang');
  const lang: Lang = langParam === 'he' ? 'he' : 'en';
  const isHebrew = lang === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  const hero = await loadImageAsDataUrl(cocktail.heroImage);

  const title = cocktail.title[lang];
  const category = CATEGORY_LABEL[cocktail.category][lang];
  const subtitle = cocktail.subtitle[lang];
  const tagline = cocktail.tagline?.[lang] ?? '';
  const note = cocktail.bartenderNote[lang];
  const flavorVals = FLAVOR_AXES.map((a) => ({
    key: a,
    label: FLAVOR_LABEL[a][lang],
    value: Math.max(0, Math.min(5, cocktail.flavor[a])),
  }));
  const brand = isHebrew ? 'מאז 2026 · חתימת הבית' : 'Est. 2026 · House Signature';

  // Load a font covering the rendered text (Latin + Hebrew).
  const allText = `${title}${category}${subtitle}${tagline}${note}${brand}${flavorVals.map((f) => f.label).join('')}1234567890`;
  const titleFontData = await loadFont(isHebrew ? 'Frank+Ruhl+Libre:wght@500' : 'Playfair+Display:ital@1', allText);
  const bodyFontData = await loadFont(isHebrew ? 'Heebo:wght@400' : 'Inter:wght@400', allText);
  const titleFamily = isHebrew ? 'Frank Ruhl Libre' : 'Playfair Display';
  const bodyFamily = isHebrew ? 'Heebo' : 'Inter';

  const fonts: { name: string; data: ArrayBuffer; weight?: 400 | 500; style?: 'normal' | 'italic' }[] = [];
  if (titleFontData) fonts.push({ name: titleFamily, data: titleFontData, weight: 500, style: isHebrew ? 'normal' : 'italic' });
  if (bodyFontData) fonts.push({ name: bodyFamily, data: bodyFontData, weight: 400, style: 'normal' });

  const accent = 'rgba(252,211,77,';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#08080a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '70px 64px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center 45%, rgba(190,24,93,0.28) 0%, rgba(120,53,15,0.10) 35%, transparent 68%)',
            display: 'flex',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
          <div
            style={{
              color: `${accent}0.85)`,
              fontSize: 18,
              letterSpacing: isHebrew ? 6 : 14,
              textTransform: 'uppercase',
              marginBottom: 16,
              fontFamily: bodyFamily,
              display: 'flex',
            }}
          >
            {category}
          </div>
          <div
            style={{
              fontSize: 88,
              fontFamily: titleFamily,
              fontStyle: isHebrew ? 'normal' : 'italic',
              fontWeight: 500,
              textAlign: 'center',
              lineHeight: 1.0,
              marginBottom: 16,
              backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #fde68a 60%, #d97706 115%)',
              backgroundClip: 'text',
              color: 'transparent',
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.7 }}>
            <div style={{ width: 60, height: 1, background: `${accent}0.6)` }} />
            <div style={{ width: 10, height: 10, border: `1.5px solid ${accent}0.8)`, transform: 'rotate(45deg)' }} />
            <div style={{ width: 60, height: 1, background: `${accent}0.6)` }} />
          </div>
        </div>

        {/* Big hero glass */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 10, marginTop: 10 }}>
          {hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt={title} width={620} height={620} style={{ objectFit: 'contain' }} />
          )}
        </div>

        {/* Flavor profile — equalizer bars */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, marginBottom: 26 }}>
          <div
            style={{
              color: `${accent}0.7)`,
              fontSize: 14,
              letterSpacing: isHebrew ? 5 : 8,
              textTransform: 'uppercase',
              marginBottom: 18,
              fontFamily: bodyFamily,
              display: 'flex',
            }}
          >
            {subtitle}
          </div>
          <div style={{ display: 'flex', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', gap: 34, alignItems: 'flex-end' }}>
            {flavorVals.map((f) => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: 26, height: 130 }}>
                  <div
                    style={{
                      width: 26,
                      height: Math.round((f.value / 5) * 130) || 4,
                      background: 'linear-gradient(180deg, #fde68a, #be185d)',
                      borderRadius: 6,
                      display: 'flex',
                    }}
                  />
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 14,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    fontFamily: bodyFamily,
                    display: 'flex',
                  }}
                >
                  {f.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            zIndex: 10,
            direction: dir,
          }}
        >
          {tagline && (
            <div
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 20,
                fontFamily: titleFamily,
                fontStyle: isHebrew ? 'normal' : 'italic',
                textAlign: 'center',
                display: 'flex',
              }}
            >
              {tagline}
            </div>
          )}
          <div
            style={{
              color: `${accent}0.5)`,
              fontSize: 13,
              letterSpacing: 6,
              textTransform: 'uppercase',
              fontFamily: bodyFamily,
              display: 'flex',
            }}
          >
            {brand}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: fonts.length ? fonts : undefined,
      headers: POSTER_CACHE_HEADERS,
    }
  );
}
