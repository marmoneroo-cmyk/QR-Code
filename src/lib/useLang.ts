'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@/data/cocktail';

const KEY = 'cocktail-demo:lang';

/**
 * Global UI language, persisted to localStorage and shared across the whole
 * app — public menu AND admin — so changing it anywhere (settings toolbar or
 * the admin toggle) is reflected everywhere. SSR-safe: defaults to 'en' on the
 * server and first client render, then hydrates from storage.
 */
export function useLang() {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === 'he' || raw === 'en') setLangState(raw);
    } catch {
      // ignore
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === 'he' || e.newValue === 'en')) setLangState(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(KEY, next);
      // Notify same-tab listeners (storage event only fires cross-tab).
      window.dispatchEvent(new CustomEvent('cocktail-lang', { detail: next }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<Lang>).detail;
      if (detail === 'he' || detail === 'en') setLangState(detail);
    };
    window.addEventListener('cocktail-lang', onLocal as EventListener);
    return () => window.removeEventListener('cocktail-lang', onLocal as EventListener);
  }, []);

  return { lang, setLang };
}
