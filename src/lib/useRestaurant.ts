'use client';

import { useCallback } from 'react';
import { useLocalStorageState } from './useLocalStorageState';

const NAME_KEY = 'cocktail-demo:restaurant-name';
const LOGO_KEY = 'cocktail-demo:restaurant-logo';
const DEFAULT_NAME = 'Diner';

const parseName = (raw: string | null): string => (raw !== null ? raw : DEFAULT_NAME);
const parseLogo = (raw: string | null): string => raw ?? '';
const identity = (s: string): string => s;

/**
 * Restaurant brand identity (name + logo), persisted to localStorage. Editable from the
 * settings toolbar and the import wizard; shown as the menu's brand eyebrow / logo. Clearing
 * the logo REMOVES the key (rather than storing an empty string).
 */
export function useRestaurant() {
  const { value: name, set: setName } = useLocalStorageState<string>(
    NAME_KEY,
    parseName,
    identity,
    DEFAULT_NAME,
  );
  const {
    value: logo,
    set: setLogoValue,
    remove: removeLogo,
  } = useLocalStorageState<string>(LOGO_KEY, parseLogo, identity, '');

  /** Set the logo (data URL or remote URL). Pass '' to clear (removes the key). */
  const setLogo = useCallback(
    (next: string) => {
      if (next) setLogoValue(next);
      else removeLogo();
    },
    [setLogoValue, removeLogo],
  );

  return { name, setName, logo, setLogo };
}
