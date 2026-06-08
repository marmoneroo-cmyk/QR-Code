'use client';

import { useEffect, useState } from 'react';

/**
 * Toggles the browser Fullscreen API so each cocktail can be shown as a true
 * full-screen, edge-to-edge experience (kiosk / in-venue display).
 */
export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can be rejected (e.g. iOS Safari) — fail silently.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      className="w-9 h-9 rounded-full border border-amber-200/30 hover:border-amber-200/70 bg-black/30 backdrop-blur-sm text-amber-200/70 hover:text-amber-100 flex items-center justify-center transition-all duration-300"
    >
      {isFullscreen ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}
    </button>
  );
}
