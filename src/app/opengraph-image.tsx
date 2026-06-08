import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function HomeOgImage() {
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
              'radial-gradient(ellipse at center, rgba(190, 24, 93, 0.3) 0%, transparent 60%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            color: 'rgba(252,211,77,0.85)',
            fontSize: 18,
            letterSpacing: 14,
            textTransform: 'uppercase',
            marginBottom: 32,
            fontFamily: 'sans-serif',
          }}
        >
          Interactive Menu · 2026
        </div>

        <div
          style={{
            fontSize: 124,
            fontFamily: 'serif',
            fontStyle: 'italic',
            fontWeight: 500,
            letterSpacing: '0.02em',
            textAlign: 'center',
            lineHeight: 0.95,
            marginBottom: 12,
            backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #fde68a 60%, #d97706 110%)',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'flex',
          }}
        >
          Our
        </div>

        <div
          style={{
            color: '#ffffff',
            fontSize: 156,
            fontFamily: 'serif',
            fontWeight: 600,
            letterSpacing: '0.02em',
            textAlign: 'center',
            lineHeight: 0.95,
            marginBottom: 36,
            display: 'flex',
          }}
        >
          Cocktails
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: 0.75,
          }}
        >
          <div style={{ width: 80, height: 1, background: 'rgba(252,211,77,0.6)' }} />
          <div
            style={{
              width: 10,
              height: 10,
              border: '1.5px solid rgba(252,211,77,0.8)',
              transform: 'rotate(45deg)',
            }}
          />
          <div style={{ width: 80, height: 1, background: 'rgba(252,211,77,0.6)' }} />
        </div>

        <div
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 28,
            fontFamily: 'serif',
            fontStyle: 'italic',
            textAlign: 'center',
            marginTop: 32,
            display: 'flex',
          }}
        >
          An immersive 3D cocktail experience.
        </div>
      </div>
    ),
    { ...size }
  );
}
