'use client';

import type { Lang } from '@/data/cocktail';
import { useLocalStorageState } from './useLocalStorageState';

const KEY = 'cocktail-demo:lang';

const parseLang = (raw: string | null): Lang => (raw === 'he' || raw === 'en' ? raw : 'en');
const serializeLang = (l: Lang): string => l;

/**
 * Global UI language, persisted to localStorage and shared across the whole app — public
 * menu AND admin — so changing it anywhere is reflected everywhere (same-tab via the shared
 * store's event, cross-tab via the `storage` event). SSR-safe: 'en' on the server and first
 * client render, then hydrates from storage. The key `cocktail-demo:lang` is also read
 * directly by the tracking client (src/lib/tracking/track.ts) — kept stable.
 */
export function useLang() {
  const { value: lang, set: setLang } = useLocalStorageState<Lang>(KEY, parseLang, serializeLang, 'en');
  return { lang, setLang };
}
