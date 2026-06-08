'use client';

import { useEffect, useRef } from 'react';
import { track } from './track';

/**
 * Measures real engagement on a cocktail page for the Engagement Intelligence
 * engine:
 *   · cocktail_dwell        — ACTIVE seconds (clock pauses on tab blur/hide), so
 *                             "8 minutes in a background tab" doesn't count.
 *   · cocktail_scroll_depth — max scroll % reached (only when the page actually
 *                             scrolls; a non-scrollable view reports nothing
 *                             rather than a misleading 100%).
 * Flushed once, on navigate-away / unmount / pagehide.
 */
export function useEngagement(cocktailSlug: string): void {
  const activeMs = useRef(0);
  const lastTick = useRef<number | null>(null);
  const maxScroll = useRef(0);
  const wasScrollable = useRef(false);
  const flushed = useRef(false);

  useEffect(() => {
    activeMs.current = 0;
    maxScroll.current = 0;
    wasScrollable.current = false;
    flushed.current = false;

    const isActive = () => document.visibilityState === 'visible' && document.hasFocus();

    const accumulate = () => {
      if (lastTick.current != null) {
        activeMs.current += Date.now() - lastTick.current;
        lastTick.current = null;
      }
    };
    const resume = () => {
      if (lastTick.current == null && isActive()) lastTick.current = Date.now();
    };

    const onVisibility = () => (isActive() ? resume() : accumulate());
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable > 4) {
        wasScrollable.current = true;
        const pct = Math.min(1, (window.scrollY || doc.scrollTop || 0) / scrollable);
        if (pct > maxScroll.current) maxScroll.current = pct;
      }
    };

    const flush = () => {
      if (flushed.current) return;
      flushed.current = true;
      accumulate();
      const seconds = Math.round(activeMs.current / 1000);
      if (seconds > 0) track({ event: 'cocktail_dwell', cocktailSlug, value: seconds });
      if (wasScrollable.current) {
        track({ event: 'cocktail_scroll_depth', cocktailSlug, value: Math.round(maxScroll.current * 100) });
      }
    };

    resume();
    onScroll();
    // Keep the active clock ticking during long, event-free views.
    const interval = window.setInterval(() => {
      if (isActive()) {
        accumulate();
        resume();
      }
    }, 5000);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', accumulate);
    window.addEventListener('focus', resume);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', flush);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', accumulate);
      window.removeEventListener('focus', resume);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [cocktailSlug]);
}
