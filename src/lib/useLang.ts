'use client';

import type { Lang } from '@/data/cocktail';
import { useLocalStorageState } from './useLocalStorageState';

const KEY = 'cocktail-demo:lang';

/**
 * A stored choice always wins. With NO stored choice we follow the guest's own
 * device language: a guest scanning the QR at an Israeli bar was shown an English
 * menu until they found the toggle, which is the wrong first impression for a
 * Hebrew-first venue. Only the first visit is affected — picking a language
 * persists it and this branch never runs again.
 */
const parseLang = (raw: string | null): Lang => {
  if (raw === 'he' || raw === 'en') return raw;
  if (typeof navigator === 'undefined') return 'en'; // SSR / first render
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return prefs.some((l) => typeof l === 'string' && l.toLowerCase().startsWith('he')) ? 'he' : 'en';
};

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
