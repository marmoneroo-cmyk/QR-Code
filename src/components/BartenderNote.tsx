'use client';

import { motion } from 'framer-motion';
import type { CocktailConfig, Lang } from '@/data/cocktail';

interface BartenderNoteProps {
  cocktail: CocktailConfig;
  lang: Lang;
}

export function BartenderNote({ cocktail, lang }: BartenderNoteProps) {
  const isHebrew = lang === 'he';
  const serifFont = isHebrew
    ? 'var(--font-frank-ruhl, serif)'
    : 'var(--font-playfair, serif)';
  const sansFont = isHebrew
    ? 'var(--font-heebo, sans-serif)'
    : 'var(--font-inter, sans-serif)';

  return (
    <motion.figure
      className="max-w-[320px] text-start"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.0, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="flex items-center justify-start gap-2 mb-3 opacity-60">
        <div className="w-6 h-px bg-amber-200/50" />
        <div className="w-1 h-1 border border-amber-200/70 rotate-45" />
        <div className="w-6 h-px bg-amber-200/50" />
      </div>

      <p
        className="text-amber-100/80 text-10 tracking-[0.45em] uppercase mb-3"
        style={{ fontFamily: sansFont }}
      >
        {isHebrew ? 'הערת הבארמן' : "Bartender's note"}
      </p>

      <blockquote
        className="text-white/85 text-19 leading-snug"
        style={{
          fontFamily: serifFont,
          fontStyle: isHebrew ? 'normal' : 'italic',
          fontWeight: 400,
        }}
      >
        “{cocktail.bartenderNote[lang]}”
      </blockquote>

      {cocktail.bartenderName && (
        <figcaption
          className="mt-3 text-white/70 text-10 tracking-[0.35em] uppercase"
          style={{ fontFamily: sansFont }}
        >
          — {cocktail.bartenderName}
        </figcaption>
      )}
    </motion.figure>
  );
}
