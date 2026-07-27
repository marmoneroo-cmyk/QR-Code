// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useLang } from './useLang';
import { __resetLocalStorageCache } from './useLocalStorageState';

const KEY = 'cocktail-demo:lang';

/** Pretend the guest's device prefers these languages (restored by the caller). */
function withNavigatorLanguages(langs: string[], run: () => void): void {
  const proto = Object.getPrototypeOf(navigator) as object;
  const origLanguages = Object.getOwnPropertyDescriptor(proto, 'languages');
  const origLanguage = Object.getOwnPropertyDescriptor(proto, 'language');
  Object.defineProperty(navigator, 'languages', { value: langs, configurable: true });
  Object.defineProperty(navigator, 'language', { value: langs[0], configurable: true });
  // The store caches parsed values per raw string — clear it so the new navigator is read.
  __resetLocalStorageCache();
  try {
    run();
  } finally {
    delete (navigator as unknown as Record<string, unknown>).languages;
    delete (navigator as unknown as Record<string, unknown>).language;
    if (origLanguages) Object.defineProperty(proto, 'languages', origLanguages);
    if (origLanguage) Object.defineProperty(proto, 'language', origLanguage);
    __resetLocalStorageCache();
  }
}

// Clear storage AND unmount (cleanup) between tests: unmounting removes the 'storage' and
// 'cocktail-lang' window listeners the hook registers, so a stale instance can't react to
// events fired by a later test.
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useLang', () => {
  it('defaults to "en" when nothing is stored and the device is English', () => {
    // jsdom's navigator is en-US, so this is the English-guest path.
    const { result } = renderHook(() => useLang());
    expect(result.current.lang).toBe('en');
  });

  it('follows a Hebrew device on the first visit (nothing stored)', () => {
    // A guest scanning the QR at an Israeli bar must not land on an English menu.
    withNavigatorLanguages(['he-IL', 'en-US'], () => {
      const { result } = renderHook(() => useLang());
      expect(result.current.lang).toBe('he');
    });
  });

  it('lets a stored choice win over the device language', () => {
    // The owner/guest explicitly picked English on a Hebrew phone — respect it.
    localStorage.setItem(KEY, 'en');
    withNavigatorLanguages(['he-IL'], () => {
      const { result } = renderHook(() => useLang());
      expect(result.current.lang).toBe('en');
    });
  });

  it('falls back to "en" for any other device language', () => {
    withNavigatorLanguages(['fr-FR', 'de-DE'], () => {
      const { result } = renderHook(() => useLang());
      expect(result.current.lang).toBe('en');
    });
  });

  it('hydrates "he" from localStorage on mount', () => {
    localStorage.setItem(KEY, 'he');
    const { result } = renderHook(() => useLang());
    expect(result.current.lang).toBe('he');
  });

  it('setLang updates the returned value and persists it', () => {
    const { result } = renderHook(() => useLang());
    act(() => result.current.setLang('he'));
    expect(result.current.lang).toBe('he');
    expect(localStorage.getItem(KEY)).toBe('he');
  });

  it('syncs same-tab: setLang on one instance updates another via the cocktail-lang event', () => {
    const a = renderHook(() => useLang());
    const b = renderHook(() => useLang());
    expect(a.result.current.lang).toBe('en');
    expect(b.result.current.lang).toBe('en');

    // setLang dispatches the shared store's same-tab CustomEvent that the OTHER instance
    // listens for (the native 'storage' event only fires cross-tab, never in the same document).
    act(() => a.result.current.setLang('he'));

    expect(a.result.current.lang).toBe('he');
    expect(b.result.current.lang).toBe('he'); // reflected without its own setLang call
  });

  it('reacts to a cross-tab storage event for the lang key', () => {
    const { result } = renderHook(() => useLang());
    act(() => {
      // A real cross-tab storage event fires AFTER the (shared) localStorage is written —
      // set it first, then dispatch. The hook re-reads the store as the source of truth.
      localStorage.setItem(KEY, 'he');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'he' }));
    });
    expect(result.current.lang).toBe('he');
  });
});
