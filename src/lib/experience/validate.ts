import type {
  ExperienceConfig,
  ExperienceModule,
  BadgeConfig,
  BadgeKind,
  BadgeLabel,
  ScheduledToggle,
} from './types';

// Keep in sync with the ExperienceModule / BadgeKind unions in './types'.
export const EXPERIENCE_MODULES: ExperienceModule[] = [
  'hero_video',
  'ingredient_breakdown',
  'story',
  'taste_profile',
  'perfect_pairings',
  'related_items',
  'mood_tags',
];

export const BADGE_KINDS: BadgeKind[] = [
  'signature',
  'guest_favorite',
  'trending',
  'happy_hour',
  'discount',
  'seasonal',
  'limited_time',
  'new_item',
  'custom',
];

export function isBadgeLabel(value: unknown): value is BadgeLabel {
  if (typeof value !== 'object' || value === null) return false;
  const label = value as Record<string, unknown>;
  return typeof label.en === 'string' && typeof label.he === 'string';
}

export function isScheduledToggle(value: unknown): value is ScheduledToggle {
  if (typeof value !== 'object' || value === null) return false;
  const toggle = value as Record<string, unknown>;
  if (typeof toggle.enabled !== 'boolean') return false;
  if (toggle.schedule !== undefined && (typeof toggle.schedule !== 'object' || toggle.schedule === null)) return false;
  return true;
}

export function isBadgeConfig(value: unknown): value is BadgeConfig {
  if (typeof value !== 'object' || value === null) return false;
  const badge = value as Record<string, unknown>;
  if (!BADGE_KINDS.includes(badge.kind as BadgeKind)) return false;
  if (badge.mode !== 'manual' && badge.mode !== 'auto') return false;
  if (typeof badge.enabled !== 'boolean') return false;
  if (badge.schedule !== undefined && (typeof badge.schedule !== 'object' || badge.schedule === null)) return false;
  if (badge.label !== undefined && !isBadgeLabel(badge.label)) return false;
  return true;
}

/**
 * Whitelist-validate the persisted+publicly-re-served experience config: every
 * top-level key must be a known ExperienceConfig field with the expected shape.
 * Unknown keys or malformed entries are rejected rather than silently dropped,
 * since this payload is served as-is to anonymous diners via GET.
 */
export function isValidExperienceConfig(value: unknown): value is ExperienceConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Record<string, unknown>;
  for (const key of Object.keys(config)) {
    if (key !== 'modules' && key !== 'badges') return false;
  }
  if (config.modules !== undefined) {
    if (typeof config.modules !== 'object' || config.modules === null || Array.isArray(config.modules)) return false;
    for (const [moduleKey, moduleValue] of Object.entries(config.modules as Record<string, unknown>)) {
      if (!EXPERIENCE_MODULES.includes(moduleKey as ExperienceModule)) return false;
      if (!isScheduledToggle(moduleValue)) return false;
    }
  }
  if (config.badges !== undefined) {
    if (!Array.isArray(config.badges)) return false;
    if (!config.badges.every(isBadgeConfig)) return false;
  }
  return true;
}
