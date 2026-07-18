'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { CocktailConfig, Lang } from '@/data/cocktail';

interface PosterButtonProps {
  cocktail: CocktailConfig;
  lang: Lang;
}

export function PosterButton({ cocktail, lang }: PosterButtonProps) {
  const [working, setWorking] = useState(false);
  const isHebrew = lang === 'he';

  const handleDownload = async () => {
    setWorking(true);
    try {
      const url = `/api/poster/${cocktail.slug}?lang=${lang}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${cocktail.slug}-poster.png`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore — could surface toast later
    } finally {
      setWorking(false);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleDownload}
      disabled={working}
      whileTap={{ scale: 0.96 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200/30 hover:border-amber-200/70 bg-black/40 backdrop-blur-sm text-amber-200/85 hover:text-amber-100 transition-all duration-300 text-10 tracking-[0.3em] uppercase disabled:opacity-40"
      style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
    >
      <svg width="11" height="12" viewBox="0 0 11 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <rect x="1.5" y="1.5" width="8" height="8" rx="0.5" />
        <line x1="3.5" y1="5" x2="7.5" y2="5" />
        <line x1="3.5" y1="7" x2="7.5" y2="7" />
      </svg>
      {working ? (isHebrew ? 'יוצר…' : 'Building…') : isHebrew ? 'פוסטר' : 'Poster'}
    </motion.button>
  );
}
