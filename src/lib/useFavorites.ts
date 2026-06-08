'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cocktail-demo:favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setFavorites(new Set(parsed));
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: ReadonlySet<string>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // ignore quota / privacy errors
    }
  }, []);

  const toggle = useCallback(
    (slug: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) {
          next.delete(slug);
        } else {
          next.add(slug);
        }
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const isFavorite = useCallback(
    (slug: string) => favorites.has(slug),
    [favorites]
  );

  return { favorites, hydrated, toggle, isFavorite };
}
