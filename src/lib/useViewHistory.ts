'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cocktail-demo:view-history';
const MAX_ENTRIES = 8;

export interface ViewEntry {
  slug: string;
  viewedAt: number;
}

function loadInitial(): ViewEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown): e is ViewEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as ViewEntry).slug === 'string' &&
        typeof (e as ViewEntry).viewedAt === 'number'
    );
  } catch {
    return [];
  }
}

export function useViewHistory() {
  const [history, setHistory] = useState<ViewEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHistory(loadInitial());
    setHydrated(true);
  }, []);

  const record = useCallback((slug: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((e) => e.slug !== slug);
      const next = [{ slug, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { history, hydrated, record, clear };
}
