'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { track } from '@/lib/tracking/track';

const MIN_DWELL_MS = 800; // ignore glances; only count real attention

interface SectionAttentionProps {
  section: string;
  slug: string;
  children: ReactNode;
  className?: string;
}

/**
 * Attention Heatmap instrument. Measures how long a section is actually on screen
 * (≥50% visible) and fires ONE `section_attention` event with the total dwell when
 * the section leaves / the page is hidden / the component unmounts. Powers the
 * "which part drew the eye" heatmap — data an owner can't get any other way.
 */
export function SectionAttention({ section, slug, children, className }: SectionAttentionProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    let visibleSince: number | null = null;
    let dwell = 0;
    let fired = false;

    const accumulate = () => {
      if (visibleSince !== null) {
        dwell += performance.now() - visibleSince;
        visibleSince = null;
      }
    };

    const flush = () => {
      accumulate();
      if (!fired && dwell >= MIN_DWELL_MS) {
        fired = true;
        const dwellMs = Math.round(dwell);
        track({ event: 'section_attention', cocktailSlug: slug, value: dwellMs, metadata: { section, dwellMs } });
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (visibleSince === null) visibleSince = performance.now();
          } else {
            accumulate();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    document.addEventListener('visibilitychange', flush);

    return () => {
      flush();
      io.disconnect();
      document.removeEventListener('visibilitychange', flush);
    };
  }, [section, slug]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
