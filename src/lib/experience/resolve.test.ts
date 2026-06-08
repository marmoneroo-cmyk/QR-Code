import { describe, it, expect } from 'vitest';
import { isModuleActive, resolveBadges, mergeBadges } from './resolve';
import type { ExperienceConfig, ActiveBadge } from './types';

const UTC = 'UTC';
const at = (iso: string) => new Date(iso);
const MON = at('2026-06-15T12:00:00Z'); // Monday, summer
const FRI_EVE = at('2026-06-05T20:00:00Z'); // Friday 20:00

describe('isModuleActive', () => {
  it('defaults modules ON when unconfigured', () => {
    expect(isModuleActive(undefined, 'story', MON, UTC)).toBe(true);
    expect(isModuleActive({}, 'hero_video', MON, UTC)).toBe(true);
  });

  it('hides a module that is explicitly disabled', () => {
    const cfg: ExperienceConfig = { modules: { story: { enabled: false } } };
    expect(isModuleActive(cfg, 'story', MON, UTC)).toBe(false);
    expect(isModuleActive(cfg, 'taste_profile', MON, UTC)).toBe(true); // others stay on
  });

  it('respects a module schedule', () => {
    const cfg: ExperienceConfig = {
      modules: { hero_video: { enabled: true, schedule: { windows: [{ kind: 'recurring', days: [5], start: '18:00', end: '23:00' }] } } },
    };
    expect(isModuleActive(cfg, 'hero_video', FRI_EVE, UTC)).toBe(true);
    expect(isModuleActive(cfg, 'hero_video', MON, UTC)).toBe(false);
  });
});

describe('resolveBadges', () => {
  it('shows a manual badge only while its schedule is active', () => {
    const cfg: ExperienceConfig = {
      badges: [{ kind: 'happy_hour', mode: 'manual', enabled: true, schedule: { windows: [{ kind: 'recurring', days: [5], start: '18:00', end: '23:00' }] } }],
    };
    expect(resolveBadges(cfg, FRI_EVE, UTC).map((b) => b.kind)).toEqual(['happy_hour']);
    expect(resolveBadges(cfg, MON, UTC)).toEqual([]);
  });

  it('activates an auto badge only when analytics context says so', () => {
    const cfg: ExperienceConfig = { badges: [{ kind: 'guest_favorite', mode: 'auto', enabled: true }] };
    expect(resolveBadges(cfg, MON, UTC, { isGuestFavorite: true }).map((b) => b.kind)).toEqual(['guest_favorite']);
    expect(resolveBadges(cfg, MON, UTC, { isGuestFavorite: false })).toEqual([]);
  });

  it('ignores a disabled auto badge even if context is true', () => {
    const cfg: ExperienceConfig = { badges: [{ kind: 'trending', mode: 'auto', enabled: false }] };
    expect(resolveBadges(cfg, MON, UTC, { isTrending: true })).toEqual([]);
  });

  it('resolves labels and tones, with custom override', () => {
    const cfg: ExperienceConfig = {
      badges: [
        { kind: 'signature', mode: 'manual', enabled: true },
        { kind: 'custom', mode: 'manual', enabled: true, label: { en: "Bartender's Pick", he: 'בחירת הברמן' } },
      ],
    };
    const out = resolveBadges(cfg, MON, UTC);
    expect(out).toEqual<ActiveBadge[]>([
      { kind: 'signature', label: { en: 'Signature', he: 'קוקטייל הבית' }, tone: 'gold' },
      { kind: 'custom', label: { en: "Bartender's Pick", he: 'בחירת הברמן' }, tone: 'accent' },
    ]);
  });

  it('de-duplicates repeated badge kinds', () => {
    const cfg: ExperienceConfig = {
      badges: [
        { kind: 'new_item', mode: 'manual', enabled: true },
        { kind: 'new_item', mode: 'manual', enabled: true },
      ],
    };
    expect(resolveBadges(cfg, MON, UTC)).toHaveLength(1);
  });
});

describe('mergeBadges', () => {
  it('merges config + promotion badges without duplicates', () => {
    const a: ActiveBadge[] = [{ kind: 'signature', label: { en: 'Signature', he: '' }, tone: 'gold' }];
    const b: ActiveBadge[] = [
      { kind: 'happy_hour', label: { en: 'Happy Hour', he: '' }, tone: 'hot' },
      { kind: 'signature', label: { en: 'Signature', he: '' }, tone: 'gold' }, // dup
    ];
    expect(mergeBadges(a, b).map((x) => x.kind)).toEqual(['signature', 'happy_hour']);
  });
});
