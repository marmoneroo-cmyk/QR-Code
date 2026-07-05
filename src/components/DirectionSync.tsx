'use client';

import { useEffect } from 'react';
import { useLang } from '@/lib/useLang';

/**
 * Keeps <html dir/lang> in sync with the global UI language so the ENTIRE app —
 * public menu AND admin — lays out right-to-left in Hebrew and left-to-right in
 * English, on every page, not only those wrapped in a dir-aware shell. With
 * dir="rtl" on the root, `text-align: start`, flex `justify-start`, and logical
 * margins all resolve to the right automatically. Renders nothing.
 */
export function DirectionSync() {
  const { lang } = useLang();

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('lang', lang);
    el.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
  }, [lang]);

  return null;
}
