'use client';

import { useMemo } from 'react';
import { useApiData } from '@/lib/data/useApiData';
import { PROMOTIONS as FALLBACK_PROMOS, EXPERIENCE_CONFIG as FALLBACK_EXP } from '@/data/experience';
import type { Promotion } from '@/lib/promotions/types';
import type { ExperienceConfig } from '@/lib/experience/types';

export interface MenuConfig {
  promotions: Promotion[];
  /** Per-slug experience config (DB overrides merged over in-code defaults). */
  experience: Record<string, ExperienceConfig>;
}

/**
 * Loads owner-configured promotions + experience from the DB, falling back to the
 * in-code defaults (so the menu always shows something, even before the owner
 * configures anything). DB promotions replace defaults only when non-empty;
 * DB experience is merged per-slug over defaults.
 *
 * Fetching goes through the shared `useApiData` (SWR) primitive, so repeated
 * mounts across the guest menu dedupe and cache instead of re-fetching every time,
 * and a failed refresh keeps the last good value. The public return shape is
 * unchanged: callers still read `{ promotions, experience }`.
 */
export function useMenuConfig(restaurant = 'diner'): MenuConfig {
  const { data: promoData } = useApiData<Promotion[]>(
    `/api/promotions?restaurant=${restaurant}&activeOnly=true`,
  );
  const { data: expData } = useApiData<Record<string, ExperienceConfig>>(
    `/api/experience?restaurant=${restaurant}`,
  );

  // DB promotions replace the in-code defaults only when the owner has active ones.
  const promotions = useMemo<Promotion[]>(
    () => (Array.isArray(promoData) && promoData.length > 0 ? promoData : FALLBACK_PROMOS),
    [promoData],
  );

  // DB experience is merged per-slug over the defaults (so unset slugs keep their
  // in-code experience); an empty payload leaves the defaults untouched.
  const experience = useMemo<Record<string, ExperienceConfig>>(
    () =>
      expData && Object.keys(expData).length > 0 ? { ...FALLBACK_EXP, ...expData } : FALLBACK_EXP,
    [expData],
  );

  return { promotions, experience };
}
