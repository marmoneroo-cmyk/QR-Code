'use client';

import { motion } from 'framer-motion';
import type { Category, Lang } from '@/data/cocktail';
import { CATEGORY_LABEL } from '@/data/cocktail';

export type CategoryFilter = Category | 'all' | 'favorites';

interface MenuFiltersProps {
  lang: Lang;
  active: CategoryFilter;
  categories: ReadonlyArray<Category>;
  favoriteCount: number;
  onChange: (filter: CategoryFilter) => void;
  query: string;
  onQueryChange: (q: string) => void;
}

export function MenuFilters({
  lang,
  active,
  categories,
  favoriteCount,
  onChange,
  query,
  onQueryChange,
}: MenuFiltersProps) {
  const isHebrew = lang === 'he';
  const sansFont = isHebrew
    ? 'var(--font-heebo, sans-serif)'
    : 'var(--font-inter, sans-serif)';

  const chips: Array<{ id: CategoryFilter; label: string }> = [
    { id: 'all', label: isHebrew ? 'הכל' : 'All' },
    ...categories.map((c) => ({
      id: c as CategoryFilter,
      label: CATEGORY_LABEL[c][lang],
    })),
    ...(favoriteCount > 0
      ? [
          {
            id: 'favorites' as CategoryFilter,
            label: isHebrew ? `מועדפים (${favoriteCount})` : `Favorites (${favoriteCount})`,
          },
        ]
      : []),
  ];

  return (
    <motion.div
      className="w-full max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.0, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="relative mb-8">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={isHebrew ? 'חיפוש קוקטייל או מרכיב…' : 'Search cocktail or ingredient…'}
          aria-label={isHebrew ? 'חיפוש' : 'Search'}
          className="w-full bg-transparent border-b border-amber-200/20 focus:border-amber-200/60 outline-none text-white text-base text-center py-3 px-8 transition-colors duration-300 placeholder:text-white/30"
          style={{ fontFamily: sansFont, fontWeight: 300 }}
        />
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-200/50 text-[18px] pointer-events-none"
          aria-hidden
        >
          ⌕
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {chips.map((chip) => {
          const isActive = active === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChange(chip.id)}
              className={`px-4 py-1.5 rounded-full border text-[11px] tracking-[0.25em] uppercase transition-all duration-300 ${
                isActive
                  ? 'border-amber-200 bg-amber-200/90 text-black shadow-[0_0_20px_rgba(252,211,77,0.3)]'
                  : 'border-amber-200/25 text-amber-200/70 hover:border-amber-200/60 hover:text-amber-100'
              }`}
              style={{ fontFamily: sansFont, fontWeight: 500 }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
