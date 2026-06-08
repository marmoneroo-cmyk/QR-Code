'use client';

import { useCallback, useEffect, useState } from 'react';

const NAME_KEY = 'cocktail-demo:restaurant-name';
const LOGO_KEY = 'cocktail-demo:restaurant-logo';
const DEFAULT_NAME = 'Diner';

/**
 * Restaurant brand identity (name + logo), persisted to localStorage.
 * Editable from the settings toolbar and the import wizard; shown as the
 * menu's brand eyebrow / logo.
 */
export function useRestaurant() {
  const [name, setNameState] = useState<string>(DEFAULT_NAME);
  const [logo, setLogoState] = useState<string>('');

  useEffect(() => {
    try {
      const rawName = window.localStorage.getItem(NAME_KEY);
      if (rawName !== null) setNameState(rawName);
      const rawLogo = window.localStorage.getItem(LOGO_KEY);
      if (rawLogo) setLogoState(rawLogo);
    } catch {
      // ignore
    }
  }, []);

  const setName = useCallback((next: string) => {
    setNameState(next);
    try {
      window.localStorage.setItem(NAME_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  /** Set the logo (data URL or remote URL). Pass '' to clear. */
  const setLogo = useCallback((next: string) => {
    setLogoState(next);
    try {
      if (next) window.localStorage.setItem(LOGO_KEY, next);
      else window.localStorage.removeItem(LOGO_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { name, setName, logo, setLogo };
}
