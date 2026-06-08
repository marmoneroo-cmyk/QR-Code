'use client';

import { motion } from 'framer-motion';
import { FLAVOR_LABEL, type FlavorProfile, type Lang } from '@/data/cocktail';

interface FlavorTagsProps {
  flavor: FlavorProfile;
  lang: Lang;
  accent?: string;
  align?: 'start' | 'end';
}

const AXES: Array<keyof FlavorProfile> = ['sweet', 'bitter', 'citrus', 'smoky', 'herbal'];
const MAX = 5;

/**
 * Compact flavour meter — keeps the quantitative "gauge" feel of the old radar
 * (a measure of sweetness / acidity / etc.) but as a modern set of labelled
 * intensity bars. Shows the cocktail's notes ranked strongest-first.
 */
export function FlavorTags({ flavor, lang, accent = '#e8b339', align = 'start' }: FlavorTagsProps) {
  const isHebrew = lang === 'he';
  const sansFont = isHebrew
    ? 'var(--font-heebo, sans-serif)'
    : 'var(--font-inter, sans-serif)';

  const ranked = AXES.map((axis) => ({ axis, value: Math.max(0, Math.min(MAX, flavor[axis])) }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div
      className="flex flex-col gap-2.5 w-[180px]"
      dir={isHebrew ? 'rtl' : 'ltr'}
      style={{ alignItems: align === 'end' ? 'flex-end' : 'flex-start' }}
    >
      {ranked.map(({ axis, value }, i) => (
        <motion.div
          key={axis}
          className="w-full"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[12px] tracking-[0.22em] uppercase text-white/85"
              style={{ fontFamily: sansFont, fontWeight: 500 }}
            >
              {FLAVOR_LABEL[axis][lang]}
            </span>
          </div>
          <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: accent }}
              initial={{ width: 0 }}
              animate={{ width: `${(value / MAX) * 100}%` }}
              transition={{ duration: 0.9, delay: 0.35 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
