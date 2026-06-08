'use client';

import { useEffect, useState } from 'react';
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
 */
export function useMenuConfig(restaurant = 'diner'): MenuConfig {
  const [promotions, setPromotions] = useState<Promotion[]>(FALLBACK_PROMOS);
  const [experience, setExperience] = useState<Record<string, ExperienceConfig>>(FALLBACK_EXP);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prRes, exRes] = await Promise.all([
          fetch(`/api/promotions?restaurant=${restaurant}&activeOnly=true`, { cache: 'no-store' }),
          fetch(`/api/experience?restaurant=${restaurant}`, { cache: 'no-store' }),
        ]);
        const pr: { success: boolean; data?: Promotion[] } = await prRes.json();
        const ex: { success: boolean; data?: Record<string, ExperienceConfig> } = await exRes.json();
        if (cancelled) return;
        if (pr.success && Array.isArray(pr.data) && pr.data.length > 0) setPromotions(pr.data);
        if (ex.success && ex.data && Object.keys(ex.data).length > 0) {
          setExperience({ ...FALLBACK_EXP, ...ex.data });
        }
      } catch {
        // keep in-code fallbacks
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurant]);

  return { promotions, experience };
}
