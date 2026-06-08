'use client';

import { useEffect, useState } from 'react';
import { timeOfDayHint } from '@/lib/timeOfDay';
import { RESTAURANT_TZ } from '@/data/experience';
import type { Lang } from '@/data/cocktail';

/** A subtle, time-aware line above the menu (restaurant timezone, set after mount). */
export function TimeOfDayHint({ lang }: { lang: Lang }) {
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    setHint(timeOfDayHint(new Date(), RESTAURANT_TZ, lang));
  }, [lang]);

  if (!hint) return null;
  const sans = lang === 'he' ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';
  return (
    <p className="text-amber-200/55 text-[11px] tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
      ✦ {hint}
    </p>
  );
}
