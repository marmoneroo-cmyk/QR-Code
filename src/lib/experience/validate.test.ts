import { describe, it, expect } from 'vitest';
import { isValidExperienceConfig, isScheduledToggle, isBadgeConfig, isBadgeLabel } from './validate';

describe('isValidExperienceConfig', () => {
  it('accepts an empty config', () => {
    expect(isValidExperienceConfig({})).toBe(true);
  });

  it('accepts a fully valid config with modules and badges', () => {
    expect(
      isValidExperienceConfig({
        modules: {
          hero_video: { enabled: true },
          story: { enabled: false, schedule: {} },
        },
        badges: [
          { kind: 'signature', mode: 'manual', enabled: true },
          { kind: 'custom', mode: 'manual', enabled: true, label: { en: 'New', he: 'חדש' } },
        ],
      }),
    ).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidExperienceConfig(null)).toBe(false);
  });

  it('rejects a string', () => {
    expect(isValidExperienceConfig('nope')).toBe(false);
  });

  it('rejects a number', () => {
    expect(isValidExperienceConfig(42)).toBe(false);
  });

  it('rejects an unknown top-level key (whitelist)', () => {
    expect(isValidExperienceConfig({ modules: {}, extra: true })).toBe(false);
  });

  it('rejects modules that is an array instead of a record', () => {
    expect(isValidExperienceConfig({ modules: [] })).toBe(false);
  });

  it('rejects modules that is null', () => {
    expect(isValidExperienceConfig({ modules: null })).toBe(false);
  });

  it('rejects modules with an unknown module key', () => {
    expect(isValidExperienceConfig({ modules: { not_a_module: { enabled: true } } })).toBe(false);
  });

  it('rejects a module toggle with a non-boolean enabled', () => {
    expect(isValidExperienceConfig({ modules: { hero_video: { enabled: 'yes' } } })).toBe(false);
  });

  it('rejects a module toggle with a non-object schedule', () => {
    expect(isValidExperienceConfig({ modules: { hero_video: { enabled: true, schedule: 'nope' } } })).toBe(false);
  });

  it('accepts a module toggle with a valid schedule object', () => {
    expect(isValidExperienceConfig({ modules: { hero_video: { enabled: true, schedule: {} } } })).toBe(true);
  });

  it('rejects badges that is not an array', () => {
    expect(isValidExperienceConfig({ badges: {} })).toBe(false);
  });

  it('rejects a badges array containing an invalid badge', () => {
    expect(isValidExperienceConfig({ badges: [{ kind: 'not_a_kind', mode: 'manual', enabled: true }] })).toBe(false);
  });

  it('accepts an empty badges array', () => {
    expect(isValidExperienceConfig({ badges: [] })).toBe(true);
  });
});

describe('isScheduledToggle', () => {
  it('accepts enabled with no schedule', () => {
    expect(isScheduledToggle({ enabled: true })).toBe(true);
    expect(isScheduledToggle({ enabled: false })).toBe(true);
  });

  it('accepts enabled with an object schedule', () => {
    expect(isScheduledToggle({ enabled: true, schedule: { windows: [] } })).toBe(true);
  });

  it('rejects non-object values', () => {
    expect(isScheduledToggle(null)).toBe(false);
    expect(isScheduledToggle('nope')).toBe(false);
    expect(isScheduledToggle(1)).toBe(false);
  });

  it('rejects a missing enabled field', () => {
    expect(isScheduledToggle({})).toBe(false);
  });

  it('rejects a non-boolean enabled field', () => {
    expect(isScheduledToggle({ enabled: 'true' })).toBe(false);
  });

  it('rejects a non-object schedule', () => {
    expect(isScheduledToggle({ enabled: true, schedule: 'nope' })).toBe(false);
    expect(isScheduledToggle({ enabled: true, schedule: null })).toBe(false);
  });
});

describe('isBadgeConfig', () => {
  it('accepts a manual badge without a label', () => {
    expect(isBadgeConfig({ kind: 'signature', mode: 'manual', enabled: true })).toBe(true);
  });

  it('accepts an auto badge', () => {
    expect(isBadgeConfig({ kind: 'trending', mode: 'auto', enabled: true })).toBe(true);
  });

  it('accepts a custom badge with a valid label', () => {
    expect(isBadgeConfig({ kind: 'custom', mode: 'manual', enabled: true, label: { en: 'Hot', he: 'חם' } })).toBe(
      true,
    );
  });

  it('rejects an invalid kind', () => {
    expect(isBadgeConfig({ kind: 'not_a_kind', mode: 'manual', enabled: true })).toBe(false);
  });

  it('rejects an invalid mode', () => {
    expect(isBadgeConfig({ kind: 'signature', mode: 'auto-ish', enabled: true })).toBe(false);
  });

  it('rejects a non-boolean enabled', () => {
    expect(isBadgeConfig({ kind: 'signature', mode: 'manual', enabled: 1 })).toBe(false);
  });

  it('rejects a non-object schedule', () => {
    expect(isBadgeConfig({ kind: 'signature', mode: 'manual', enabled: true, schedule: 'nope' })).toBe(false);
  });

  it('rejects an invalid label shape', () => {
    expect(isBadgeConfig({ kind: 'custom', mode: 'manual', enabled: true, label: { en: 'Hot' } })).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(isBadgeConfig(null)).toBe(false);
    expect(isBadgeConfig('nope')).toBe(false);
  });
});

describe('isBadgeLabel', () => {
  it('accepts a bilingual label', () => {
    expect(isBadgeLabel({ en: 'New', he: 'חדש' })).toBe(true);
  });

  it('rejects a label missing "he"', () => {
    expect(isBadgeLabel({ en: 'New' })).toBe(false);
  });

  it('rejects non-string fields', () => {
    expect(isBadgeLabel({ en: 'New', he: 5 })).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(isBadgeLabel(null)).toBe(false);
    expect(isBadgeLabel('nope')).toBe(false);
  });
});
