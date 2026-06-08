'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Currency } from '@/data/cocktail';

const STORAGE_KEY = 'cocktail-demo:currency';

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>('ILS');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === 'ILS' || raw === 'USD' || raw === 'EUR') {
        setCurrencyState(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  return { currency, setCurrency };
}
