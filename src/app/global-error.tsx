'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for errors thrown by the ROOT layout itself. It replaces the whole
 * document, so it must render its own <html>/<body> and cannot rely on globals.css / fonts
 * — everything here is inline-styled and self-contained. Bilingual so it reads regardless
 * of which language was active when the layout failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="he">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#030304',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: '#f7e6c4' }}>
            משהו השתבש · Something went wrong
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
            נתקלנו בתקלה בלתי־צפויה. אפשר לנסות שוב. · We hit an unexpected error — please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              background: '#fde8b0',
              color: '#000',
              border: 'none',
              borderRadius: 999,
              padding: '12px 24px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            נסו שוב · Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 12, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
