'use client';

import { motion } from 'framer-motion';
import type { CocktailConfig, Lang } from '@/data/cocktail';

interface PairingsProps {
  cocktail: CocktailConfig;
  lang: Lang;
}

export function Pairings({ cocktail, lang }: PairingsProps) {
  if (!cocktail.pairings || cocktail.pairings.length === 0) return null;
  const isHebrew = lang === 'he';
  const sansFont = isHebrew
    ? 'var(--font-heebo, sans-serif)'
    : 'var(--font-inter, sans-serif)';
  const serifFont = isHebrew
    ? 'var(--font-frank-ruhl, serif)'
    : 'var(--font-playfair, serif)';

  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <p
        className="text-amber-200/70 text-9 tracking-[0.5em] uppercase mb-2"
        style={{ fontFamily: sansFont }}
      >
        {isHebrew ? 'משתלב עם' : 'Pairs with'}
      </p>
      <p
        className="text-white/70 text-13 tracking-[0.05em]"
        style={{
          fontFamily: serifFont,
          fontStyle: isHebrew ? 'normal' : 'italic',
          fontWeight: 400,
        }}
      >
        {cocktail.pairings.map((p) => p[lang]).join('  ·  ')}
      </p>
    </motion.div>
  );
}
