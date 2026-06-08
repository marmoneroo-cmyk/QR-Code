'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { track } from '@/lib/tracking/track';
import { markImpressedOnce } from '@/lib/tracking/session';

/**
 * Fires a single `cocktail_impression` when its child actually scrolls into
 * view (≥50% visible), deduped per browser session. This makes "seen" mean
 * "the diner actually laid eyes on this card" — not "it existed in the list".
 */
interface ImpressionTrackerProps {
  slug: string;
  className?: string;
  children: ReactNode;
}

export function ImpressionTracker({ slug, className, children }: ImpressionTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (markImpressedOnce(slug)) {
              track({ event: 'cocktail_impression', cocktailSlug: slug });
            }
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [slug]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
