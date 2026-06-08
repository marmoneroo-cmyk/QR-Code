import { isScheduleActive } from '../scheduling/schedule';
import { badgeLabel, BADGE_TONES } from './badges';
import type {
  ExperienceConfig,
  ExperienceModule,
  ActiveBadge,
  BadgeAutoContext,
  BadgeKind,
} from './types';

/**
 * Content modules default ON — a cocktail shows its full experience unless the
 * owner explicitly disables or schedules a module off.
 */
export function isModuleActive(
  config: ExperienceConfig | null | undefined,
  module: ExperienceModule,
  now: Date,
  tz: string,
): boolean {
  const toggle = config?.modules?.[module];
  if (!toggle) return true;
  if (!toggle.enabled) return false;
  return isScheduleActive(toggle.schedule, now, tz);
}

/** Every content module's active state, resolved together. */
export interface ActiveModules {
  taste_profile: boolean;
  story: boolean;
  perfect_pairings: boolean;
  related_items: boolean;
  ingredient_breakdown: boolean;
  hero_video: boolean;
  mood_tags: boolean;
}

/** Resolve all content modules at once for a cocktail (defaults ON). */
export function resolveModules(
  config: ExperienceConfig | null | undefined,
  now: Date,
  tz: string,
): ActiveModules {
  return {
    taste_profile: isModuleActive(config, 'taste_profile', now, tz),
    story: isModuleActive(config, 'story', now, tz),
    perfect_pairings: isModuleActive(config, 'perfect_pairings', now, tz),
    related_items: isModuleActive(config, 'related_items', now, tz),
    ingredient_breakdown: isModuleActive(config, 'ingredient_breakdown', now, tz),
    hero_video: isModuleActive(config, 'hero_video', now, tz),
    mood_tags: isModuleActive(config, 'mood_tags', now, tz),
  };
}

function autoActive(kind: BadgeKind, ctx: BadgeAutoContext): boolean {
  switch (kind) {
    case 'guest_favorite':
      return !!ctx.isGuestFavorite;
    case 'trending':
      return !!ctx.isTrending;
    case 'new_item':
      return !!ctx.isNew;
    default:
      return false;
  }
}

function dedupeKey(b: ActiveBadge): string {
  return b.kind === 'custom' ? `custom:${b.label.en}:${b.label.he}` : b.kind;
}

/**
 * Badges that are active right now from the per-item config.
 * - manual: `enabled` AND its schedule is active.
 * - auto:   `enabled` (owner allows it) AND analytics context says so.
 */
export function resolveBadges(
  config: ExperienceConfig | null | undefined,
  now: Date,
  tz: string,
  ctx: BadgeAutoContext = {},
): ActiveBadge[] {
  const configured = config?.badges ?? [];
  const out: ActiveBadge[] = [];
  const seen = new Set<string>();
  for (const b of configured) {
    const active =
      b.mode === 'manual'
        ? b.enabled && isScheduleActive(b.schedule, now, tz)
        : b.enabled && autoActive(b.kind, ctx);
    if (!active) continue;
    const badge: ActiveBadge = { kind: b.kind, label: badgeLabel(b.kind, b.label), tone: BADGE_TONES[b.kind] };
    const key = dedupeKey(badge);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(badge);
  }
  return out;
}

/** Merge several badge lists (e.g. config badges + promotion badges), de-duplicated. */
export function mergeBadges(...lists: ActiveBadge[][]): ActiveBadge[] {
  const out: ActiveBadge[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const b of list) {
      const key = dedupeKey(b);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(b);
    }
  }
  return out;
}
