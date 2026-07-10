'use client';

import { useCallback } from 'react';
import { useLocalStorageState } from './useLocalStorageState';

const KEY = 'cocktail-demo:menuOrder';
const EMPTY: string[] = [];

function parseOrder(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : EMPTY;
  } catch {
    return EMPTY;
  }
}

const serializeOrder = (slugs: string[]): string => JSON.stringify(slugs);

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
 * Custom published-menu order, persisted to localStorage (per-device). `apply` reorders any
 * {slug}[] by the saved order with a safe identity fallback when no custom order exists.
 * Backed by the shared SSR-safe localStorage store (useLocalStorageState).
 */
export function useMenuOrder() {
  const { value: order, set: setOrder } = useLocalStorageState<string[]>(
    KEY,
    parseOrder,
    serializeOrder,
    EMPTY,
  );

  const apply = useCallback(
    <T extends { slug: string }>(items: readonly T[]): T[] => applyOrder(items, order),
    [order],
  );

  return { order, setOrder, apply };
}
