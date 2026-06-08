'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'cocktail-demo:menuOrder';

function readOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Stable reorder by a list of slugs: items whose slug appears in `order` come
 * first, in `order`'s sequence; every other item keeps its ORIGINAL relative
 * order after them. An empty `order` returns the items unchanged (identity) —
 * so with no custom order set, callers render exactly as before. Pure.
 */
export function applyOrder<T extends { slug: string }>(items: readonly T[], order: readonly string[]): T[] {
  if (order.length === 0) return [...items];
  const rank = new Map(order.map((slug, i) => [slug, i] as const));
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const ra = rank.get(a.item.slug);
      const rb = rank.get(b.item.slug);
      if (ra === undefined && rb === undefined) return a.i - b.i; // both unranked → original order
      if (ra === undefined) return 1; // unranked goes after ranked
      if (rb === undefined) return -1;
      return ra - rb;
    })
    .map(({ item }) => item);
}

/**
 * Custom published-menu order, persisted to localStorage (per-device, like the
 * drafts store). `apply` reorders any {slug}[] by the saved order with a safe
 * identity fallback when no custom order exists.
 */
export function useMenuOrder() {
  const [order, setOrderState] = useState<string[]>([]);

  useEffect(() => {
    setOrderState(readOrder());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setOrderState(readOrder());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setOrder = useCallback((slugs: string[]) => {
    setOrderState(slugs);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(slugs));
    } catch {
      // ignore quota / private-mode
    }
  }, []);

  const apply = useCallback(
    <T extends { slug: string }>(items: readonly T[]): T[] => applyOrder(items, order),
    [order],
  );

  return { order, setOrder, apply };
}
