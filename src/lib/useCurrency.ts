'use client';

import type { Currency } from '@/data/cocktail';
import { useLocalStorageState } from './useLocalStorageState';

const KEY = 'cocktail-demo:currency';

const parseCurrency = (raw: string | null): Currency =>
  raw === 'ILS' || raw === 'USD' || raw === 'EUR' ? raw : 'ILS';
const serializeCurrency = (c: Currency): string => c;

export function useCurrency() {
  const { value: currency, set: setCurrency } = useLocalStorageState<Currency>(
    KEY,
    parseCurrency,
    serializeCurrency,
    'ILS',
  );
  return { currency, setCurrency };
}
