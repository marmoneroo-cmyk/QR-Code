'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { findCocktailBySlug, type Lang } from '@/data/cocktail';

interface Related {
  slug: string;
  coViews: number;
}
interface CoViewRow {
  slug: string;
  views: number;
  related: Related[];
}

/**
 * "Guests also viewed" — data-driven cross-sell from real co-view behaviour
 * (`/api/analytics/recommendations`). Renders nothing until there is real data,
 * so it never shows fabricated suggestions.
 */
export function AlsoViewed({ slug, lang }: { slug: string; lang: Lang }) {
  const [related, setRelated] = useState<Related[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/analytics/recommendations', { cache: 'no-store' });
        const json: { success: boolean; data?: { rows: CoViewRow[] } } = await res.json();
        if (cancelled) return;
        const row = json.data?.rows?.find((r) => r.slug === slug);
        if (row) setRelated(row.related.slice(0, 4));
      } catch {
        // silent — section simply stays hidden
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const items = related
    .map((r) => ({ slug: r.slug, cocktail: findCocktailBySlug(r.slug) }))
    .filter((r): r is { slug: string; cocktail: NonNullable<ReturnType<typeof findCocktailBySlug>> } => Boolean(r.cocktail));

  if (items.length === 0) return null;

  const isHebrew = lang === 'he';
  const sans = isHebrew ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';

  return (
    <section className="px-5 pt-10 flex flex-col items-center" dir={isHebrew ? 'rtl' : 'ltr'}>
      <p className="text-amber-200/70 text-[10px] tracking-[0.45em] uppercase mb-5" style={{ fontFamily: sans }}>
        {isHebrew ? 'אורחים צפו גם ב' : 'Guests also viewed'}
      </p>
      <div className="flex flex-wrap items-start justify-center gap-5 max-w-3xl">
        {items.map(({ slug: s, cocktail }) => (
          <Link
            key={s}
            href={`/cocktails/${s}`}
            className="group flex flex-col items-center gap-2 w-24"
          >
            {cocktail.heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cocktail.heroImage}
                alt=""
                aria-hidden
                className="w-20 h-24 object-contain mix-blend-screen transition-transform duration-300 group-hover:scale-105"
              />
            )}
            <span
              className="text-white/70 group-hover:text-white text-[12px] text-center leading-tight transition-colors"
              style={{ fontFamily: sans }}
            >
              {cocktail.title[lang]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
