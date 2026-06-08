import { ImageResponse } from 'next/og';
import { findCocktailBySlug } from '@/data/cocktail';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface ImageProps {
  params: Promise<{ slug: string }>;
}

export default async function CocktailOgImage({ params }: ImageProps) {
  const { slug } = await params;
  const cocktail = findCocktailBySlug(slug);

  const title = cocktail?.title.en ?? 'Cocktail';
  const tagline = cocktail?.tagline?.en ?? '';
  const category = cocktail?.category ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center bottom, rgba(190, 24, 93, 0.35) 0%, rgba(120, 53, 15, 0.1) 30%, transparent 60%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 50%, rgba(252,211,77,0.08), transparent 60%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: 0.75,
            marginBottom: 32,
          }}
        >
          <div style={{ width: 60, height: 1, background: 'rgba(252,211,77,0.6)' }} />
          <div
            style={{
              width: 10,
              height: 10,
              border: '1.5px solid rgba(252,211,77,0.8)',
              transform: 'rotate(45deg)',
            }}
          />
          <div style={{ width: 60, height: 1, background: 'rgba(252,211,77,0.6)' }} />
        </div>

        <div
          style={{
            color: 'rgba(252,211,77,0.85)',
            fontSize: 18,
            letterSpacing: 12,
            textTransform: 'uppercase',
            marginBottom: 30,
            fontFamily: 'serif',
          }}
        >
          {category ? `${category} · Interactive Menu` : 'Interactive Menu'}
        </div>

        <div
          style={{
            fontSize: 96,
            fontFamily: 'serif',
            fontStyle: 'italic',
            fontWeight: 500,
            letterSpacing: '0.02em',
            textAlign: 'center',
            lineHeight: 1.05,
            marginBottom: 28,
            backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #fde68a 70%, #d97706 110%)',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'flex',
          }}
        >
          {title}
        </div>

        {tagline && (
          <div
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 28,
              fontFamily: 'serif',
              fontStyle: 'italic',
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.3,
              display: 'flex',
            }}
          >
            {tagline}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 80,
            color: 'rgba(252,211,77,0.5)',
            fontSize: 14,
            letterSpacing: 8,
            textTransform: 'uppercase',
            fontFamily: 'sans-serif',
            display: 'flex',
          }}
        >
          Est. 2026 · House Signature
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 80,
            color: 'rgba(252,211,77,0.5)',
            fontSize: 14,
            letterSpacing: 8,
            textTransform: 'uppercase',
            fontFamily: 'sans-serif',
            display: 'flex',
          }}
        >
          Tap to Explore
        </div>
      </div>
    ),
    { ...size }
  );
}
