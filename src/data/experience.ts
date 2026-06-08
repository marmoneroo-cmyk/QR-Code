import type { CocktailConfig } from './cocktail';
import { getEconomics } from './cocktail';
import { resolveBadges, mergeBadges } from '../lib/experience/resolve';
import type { ExperienceConfig, ActiveBadge } from '../lib/experience/types';
import { activePromotionsFor, priceFor, promotionBadges } from '../lib/promotions/promotions';
import type { Promotion, PricedResult } from '../lib/promotions/types';

/**
 * Menu Experience + Promotions — v1 source of truth (in code, like COCKTAIL_VIDEOS).
 * The "Menu Experience Builder" admin screen will later override this per-tenant
 * from Supabase (resilient store pattern); the read API stays the same.
 *
 * All time-based resolution uses the RESTAURANT timezone, never the guest clock.
 */
export const RESTAURANT_TZ = 'Asia/Jerusalem';

/** Per-cocktail experience config (module toggles + manual/auto badges). */
export const EXPERIENCE_CONFIG: Record<string, ExperienceConfig> = {
  'diner-aperol-spritz': {
    badges: [{ kind: 'signature', mode: 'manual', enabled: true }],
  },
  'diner-pinky': {
    badges: [
      {
        kind: 'new_item',
        mode: 'manual',
        enabled: true,
        schedule: { windows: [{ kind: 'range', startDate: '2026-06-01', endDate: '2026-06-30' }] },
      },
    ],
  },
};

/** Active promotions (the Promotions Engine — also drives promo badges). */
export const PROMOTIONS: Promotion[] = [
  {
    id: 'fri-happy-hour',
    name: 'Friday Happy Hour',
    type: 'percentage',
    value: 20,
    scope: 'all',
    schedule: { windows: [{ kind: 'recurring', days: [5], start: '17:00', end: '20:00' }] },
    badgeKind: 'happy_hour',
  },
  {
    id: 'summer-garden',
    name: 'Summer Special',
    type: 'percentage',
    value: 15,
    scope: 'item',
    targetSlugs: ['garden-spritz'],
    schedule: { windows: [{ kind: 'seasonal', startMonthDay: '06-01', endMonthDay: '08-31' }] },
    badgeKind: 'seasonal',
  },
];

export function getExperienceConfig(slug: string): ExperienceConfig | undefined {
  return EXPERIENCE_CONFIG[slug];
}

/** Overrides sourced from the DB (Experience Builder / Promotions Engine). */
export interface MenuConfigOverrides {
  promotions?: Promotion[];
  experienceConfig?: ExperienceConfig;
}

/** Badges active right now for a cocktail: config badges merged with promotion badges. */
export function resolveDinerBadges(
  cocktail: Pick<CocktailConfig, 'slug' | 'category'>,
  now: Date,
  overrides: MenuConfigOverrides = {},
): ActiveBadge[] {
  const config = overrides.experienceConfig ?? EXPERIENCE_CONFIG[cocktail.slug];
  const promotions = overrides.promotions ?? PROMOTIONS;
  const configBadges = resolveBadges(config, now, RESTAURANT_TZ);
  const active = activePromotionsFor(
    promotions,
    { slug: cocktail.slug, category: cocktail.category },
    now,
    RESTAURANT_TZ,
  );
  return mergeBadges(configBadges, promotionBadges(active));
}

/** Final (possibly discounted) price for a cocktail right now. */
export function resolveDinerPrice(
  cocktail: Pick<CocktailConfig, 'slug' | 'priceILS' | 'costILS' | 'category'>,
  now: Date,
  overrides: MenuConfigOverrides = {},
): PricedResult {
  const price = getEconomics(cocktail).price;
  const promotions = overrides.promotions ?? PROMOTIONS;
  return priceFor(
    price,
    promotions,
    { slug: cocktail.slug, category: cocktail.category },
    now,
    RESTAURANT_TZ,
  );
}
