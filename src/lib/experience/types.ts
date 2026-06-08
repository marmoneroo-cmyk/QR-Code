import type { Schedule } from '../scheduling/types';

/**
 * Menu Experience layer — per-item, owner-configurable content modules + badges,
 * every one independently enable/disable/schedulable. This is the data model the
 * "Menu Experience Builder" admin screen edits and the diner app reads.
 */

/** Bilingual display label (matches the app's en/he convention). */
export interface BadgeLabel {
  en: string;
  he: string;
}

/** Content modules on the cocktail page that the owner can toggle / schedule. */
export type ExperienceModule =
  | 'hero_video'
  | 'ingredient_breakdown'
  | 'story'
  | 'taste_profile'
  | 'perfect_pairings'
  | 'related_items'
  | 'mood_tags';

/** All badge kinds. `discount` / `happy_hour` are normally driven by the Promotions Engine. */
export type BadgeKind =
  | 'signature'
  | 'guest_favorite'
  | 'trending'
  | 'happy_hour'
  | 'discount'
  | 'seasonal'
  | 'limited_time'
  | 'new_item'
  | 'custom';

/** Styling hint so the UI can theme a badge consistently. */
export type BadgeTone = 'gold' | 'hot' | 'cool' | 'accent';

/** A toggle that is optionally time-boxed by a schedule. */
export interface ScheduledToggle {
  enabled: boolean;
  /** WHEN it runs. Absent => whenever `enabled` is true. */
  schedule?: Schedule;
}

/**
 * Badge configuration.
 * - `manual`: owner forces it on (optionally scheduled, e.g. "New" for 30 days).
 * - `auto`: activated by the platform from analytics (Guest Favorite, Trending) —
 *   `enabled` then means "allow auto-activation".
 */
export interface BadgeConfig {
  kind: BadgeKind;
  mode: 'manual' | 'auto';
  enabled: boolean;
  schedule?: Schedule;
  /** Override label; REQUIRED for `custom`. */
  label?: BadgeLabel;
}

/** The full per-item experience config (stored as jsonb on the cocktail). */
export interface ExperienceConfig {
  modules?: Partial<Record<ExperienceModule, ScheduledToggle>>;
  badges?: BadgeConfig[];
}

/** A badge resolved as active right now, ready to render. */
export interface ActiveBadge {
  kind: BadgeKind;
  label: BadgeLabel;
  tone: BadgeTone;
}

/** Signals (derived from analytics) that drive `auto` badges. */
export interface BadgeAutoContext {
  isGuestFavorite?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
}
