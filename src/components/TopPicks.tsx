'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { findCocktailBySlug, type Lang } from '@/data/cocktail';
import type { MenuEngineering } from '@/lib/analytics/types';

interface Pick {
  slug: string;
  label: { en: string; he: string };
}

/** Data-driven "Top Picks" — Most Viewed + Hidden Gem from real analytics. Hidden without data. */
export function TopPicks({ lang }: { lang: Lang }) {
  const [picks, setPicks] = useState<Pick[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/analytics/menu-engineering', { cache: 'no-store' });
        const json: { success: boolean; data?: MenuEngineering } = await res.json();
        if (cancelled || !json.success || !json.data) return;
        const items = json.data.items;
        const out: Pick[] = [];
        const mostViewed = [...items].filter((i) => i.views > 0).sort((a, b) => b.views - a.views)[0];
        if (mostViewed) out.push({ slug: mostViewed.slug, label: { en: 'Most Viewed', he: 'הכי נצפה' } });
        const gem = items.find((i) => i.highInterestLowConversion && i.slug !== mostViewed?.slug);
        if (gem) out.push({ slug: gem.slug, label: { en: 'Hidden Gem', he: 'פנינה נסתרת' } });
        setPicks(out);
      } catch {
        // hidden without data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = picks
    .map((p) => ({ ...p, cocktail: findCocktailBySlug(p.slug) }))
    .filter((p): p is Pick & { cocktail: NonNullable<ReturnType<typeof findCocktailBySlug>> } => Boolean(p.cocktail));

  if (items.length === 0) return null;
  const isHebrew = lang === 'he';
  const sans = isHebrew ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';

  return (
    <div className="flex flex-col items-center gap-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <p className="text-amber-200/70 text-[10px] tracking-[0.45em] uppercase" style={{ fontFamily: sans }}>
        {isHebrew ? 'הבחירות המובילות' : 'Top Picks'}
      </p>
      <div className="flex flex-wrap items-start justify-center gap-7">
        {items.map(({ slug, label, cocktail }) => (
          <Link key={slug} href={`/cocktails/${slug}`} className="group flex flex-col items-center gap-2 w-28">
            <span className="text-amber-200/80 text-[9px] tracking-[0.25em] uppercase" style={{ fontFamily: sans }}>
              {label[lang]}
            </span>
            {cocktail.heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cocktail.heroImage}
                alt=""
                aria-hidden
                className="w-20 h-24 object-contain mix-blend-screen transition-transform duration-300 group-hover:scale-105"
              />
            )}
            <span className="text-white/75 group-hover:text-white text-[12px] text-center leading-tight transition-colors" style={{ fontFamily: sans }}>
              {cocktail.title[lang]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
