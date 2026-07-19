'use client';

import { motion } from 'framer-motion';
import type { Lang } from '@/data/cocktail';

interface LanguageToggleProps {
  lang: Lang;
  onChange: (lang: Lang) => void;
}

const OPTIONS: ReadonlyArray<{ value: Lang; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'he', label: 'עב' },
];

export function LanguageToggle({ lang, onChange }: LanguageToggleProps) {
  return (
    <motion.div
      className="pointer-events-auto"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.0, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center border border-amber-200/30 rounded-full overflow-hidden backdrop-blur-sm bg-black/30">
        {OPTIONS.map((opt) => {
          const isActive = lang === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              aria-pressed={isActive}
              className={`px-4 py-1.5 text-11 tracking-[0.2em] uppercase transition-all duration-300 font-sans ${
                isActive
                  ? 'bg-amber-200/90 text-black'
                  : 'text-amber-200/70 hover:text-amber-200'
              }`}
              style={{ fontWeight: 500 }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
