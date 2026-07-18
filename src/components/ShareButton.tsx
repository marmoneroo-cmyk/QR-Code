'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { CocktailConfig, Lang } from '@/data/cocktail';

interface ShareButtonProps {
  cocktail: CocktailConfig;
  lang: Lang;
}

export function ShareButton({ cocktail, lang }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const isHebrew = lang === 'he';

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const title = cocktail.title[lang];
    const text = cocktail.tagline?.[lang] ?? '';

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleShare}
      whileTap={{ scale: 0.96 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200/30 hover:border-amber-200/70 bg-black/40 backdrop-blur-sm text-amber-200/85 hover:text-amber-100 transition-all duration-300 text-10 tracking-[0.3em] uppercase"
      style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
      aria-label={isHebrew ? 'שתף' : 'Share'}
    >
      <svg
        width="11"
        height="12"
        viewBox="0 0 11 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8.5" cy="2.5" r="1.5" />
        <circle cx="2.5" cy="6" r="1.5" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <line x1="3.8" y1="5.3" x2="7.2" y2="3.2" />
        <line x1="3.8" y1="6.7" x2="7.2" y2="8.8" />
      </svg>
      {copied
        ? isHebrew
          ? 'הקישור הועתק'
          : 'Link copied'
        : isHebrew
          ? 'שתף'
          : 'Share'}
    </motion.button>
  );
}
