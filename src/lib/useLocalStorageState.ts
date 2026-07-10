'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * One SSR-safe localStorage-backed state hook, shared by the app's client-state hooks
 * (useLang / useCurrency / useRestaurant) instead of each re-implementing read + write +
 * cross-tab + same-tab wiring with a mount effect (which React 19's set-state-in-effect
 * rule flags). Built on useSyncExternalStore — the correct primitive for external state.
 *
 * SSR: getServerSnapshot returns the default, so the hydration render matches the server
 * (same behaviour as the old useState(default)+effect pattern), then the stored value takes
 * over after mount. Reactivity: `storage` events (cross-tab) + a per-key CustomEvent that
 * the setter dispatches (same-tab, since `storage` only fires in OTHER tabs).
 *
 * Snapshot stability: getSnapshot MUST return a referentially-stable value or
 * useSyncExternalStore loops forever — so parsed values are cached per raw string.
 */
const cache = new Map<string, { raw: string | null; value: unknown }>();

function eventName(key: string): string {
  return `lss:${key}`;
}

function readRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface LocalStorageState<T> {
  value: T;
  set: (next: T) => void;
  /** Remove the key entirely (distinct from writing an empty value). */
  remove: () => void;
}

export function useLocalStorageState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string,
  serverValue: T,
): LocalStorageState<T> {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const invalidate = () => {
        cache.delete(key);
        onChange();
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) invalidate();
      };
      window.addEventListener('storage', onStorage);
      window.addEventListener(eventName(key), invalidate);
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(eventName(key), invalidate);
      };
    },
    [key],
  );

  const getSnapshot = useCallback((): T => {
    const raw = readRaw(key);
    const cached = cache.get(key);
    if (cached && cached.raw === raw) return cached.value as T;
    const value = parse(raw);
    cache.set(key, { raw, value });
    return value;
  }, [key, parse]);

  const getServerSnapshot = useCallback((): T => serverValue, [serverValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, serialize(next));
      } catch {
        /* quota / private mode — value still updates in-memory below */
      }
      cache.delete(key);
      window.dispatchEvent(new Event(eventName(key)));
    },
    [key, serialize],
  );

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    cache.delete(key);
    window.dispatchEvent(new Event(eventName(key)));
  }, [key]);

  return { value, set, remove };
}

/** Test-only: clear the module cache so tests don't leak parsed snapshots into each other. */
export function __resetLocalStorageCache(): void {
  cache.clear();
}
