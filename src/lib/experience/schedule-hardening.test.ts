import { describe, it, expect } from 'vitest';
import { isScheduledToggle, isBadgeConfig, isValidExperienceConfig } from './validate';
import { isScheduleActive } from '../scheduling/schedule';

/**
 * The experience config is accepted from the admin API, persisted, and then re-served
 * and EVALUATED on every guest menu render. So anything the validator accepts must be
 * safe to evaluate — otherwise a malformed-but-accepted config takes down the menu.
 */

const NOW = new Date('2026-07-20T12:00:00Z');
const TZ = 'Asia/Jerusalem';

describe('a schedule that validation accepts must be safe to evaluate', () => {
  const acceptedSchedules: { label: string; schedule: unknown }[] = [
    { label: 'empty object (no windows key)', schedule: {} },
    { label: 'array instead of object', schedule: [] },
    { label: 'windows is not an array', schedule: { windows: 'nope' } },
    { label: 'windows is null', schedule: { windows: null } },
    { label: 'unknown junk keys', schedule: { nonsense: 1 } },
  ];

  for (const { label, schedule } of acceptedSchedules) {
    it(`does not crash the menu for: ${label}`, () => {
      const toggleAccepted = isScheduledToggle({ enabled: true, schedule });
      // If validation lets it through, evaluating it must not throw.
      if (toggleAccepted) {
        expect(() => isScheduleActive(schedule as never, NOW, TZ)).not.toThrow();
      }
    });
  }

  it('isScheduleActive tolerates a structurally invalid schedule', () => {
    expect(() => isScheduleActive({} as never, NOW, TZ)).not.toThrow();
    expect(() => isScheduleActive([] as never, NOW, TZ)).not.toThrow();
    expect(() => isScheduleActive({ windows: 'nope' } as never, NOW, TZ)).not.toThrow();
    expect(() => isScheduleActive({ windows: null } as never, NOW, TZ)).not.toThrow();
  });

  it('treats a structurally invalid schedule as always-active (same as no schedule)', () => {
    expect(isScheduleActive({} as never, NOW, TZ)).toBe(true);
    expect(isScheduleActive({ windows: null } as never, NOW, TZ)).toBe(true);
  });
});

describe('validation rejects structurally invalid schedules outright', () => {
  it('rejects a toggle whose schedule has no valid windows array', () => {
    expect(isScheduledToggle({ enabled: true, schedule: {} })).toBe(false);
    expect(isScheduledToggle({ enabled: true, schedule: [] })).toBe(false);
    expect(isScheduledToggle({ enabled: true, schedule: { windows: 'nope' } })).toBe(false);
  });

  it('still accepts a genuinely valid schedule and an absent one', () => {
    expect(isScheduledToggle({ enabled: true })).toBe(true);
    expect(isScheduledToggle({ enabled: false, schedule: { windows: [] } })).toBe(true);
    expect(
      isScheduledToggle({
        enabled: true,
        schedule: { windows: [{ kind: 'recurring', days: [5], start: '22:00', end: '02:00' }] },
      }),
    ).toBe(true);
  });

  it('rejects a badge whose schedule is structurally invalid', () => {
    const badge = (schedule: unknown) => ({ kind: 'happy_hour', mode: 'manual', enabled: true, schedule });
    expect(isBadgeConfig(badge({}))).toBe(false);
    expect(isBadgeConfig(badge({ windows: 'nope' }))).toBe(false);
    expect(isBadgeConfig(badge({ windows: [] }))).toBe(true);
  });

  it('rejects an experience config carrying a malformed module schedule', () => {
    expect(
      isValidExperienceConfig({ modules: { story: { enabled: true, schedule: {} } } }),
    ).toBe(false);
  });

  it('bounds the number of windows in a stored schedule', () => {
    const tooMany = { windows: Array.from({ length: 200 }, () => ({ kind: 'recurring', days: [], start: '00:00', end: '24:00' })) };
    expect(isScheduledToggle({ enabled: true, schedule: tooMany })).toBe(false);
  });
});
