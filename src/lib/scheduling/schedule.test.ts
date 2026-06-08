import { describe, it, expect } from 'vitest';
import { isScheduleActive, isWindowActive, localParts, ALWAYS } from './schedule';
import type { Schedule } from './types';

// Anchored real weekdays (verified): 2026-06-05 Fri, 06-06 Sat, 06-07 Sun, 06-15 Mon.
const UTC = 'UTC';
const at = (iso: string) => new Date(iso);

describe('localParts', () => {
  it('extracts restaurant-local parts in the given timezone (DST-correct)', () => {
    // 2026-06-05T22:30Z = Fri 22:30 UTC, but Sat 01:30 in Israel (UTC+3 in June).
    const inst = at('2026-06-05T22:30:00Z');
    expect(localParts(inst, UTC)).toMatchObject({ weekday: 5, minutes: 22 * 60 + 30 });
    expect(localParts(inst, 'Asia/Jerusalem')).toMatchObject({ weekday: 6, minutes: 90 });
  });
});

describe('always-active schedules', () => {
  it('treats empty / null / undefined as always active', () => {
    expect(isScheduleActive(ALWAYS, at('2026-06-15T03:00:00Z'), UTC)).toBe(true);
    expect(isScheduleActive(null, at('2026-06-15T03:00:00Z'), UTC)).toBe(true);
    expect(isScheduleActive(undefined, at('2026-06-15T03:00:00Z'), UTC)).toBe(true);
  });
});

describe('recurring windows', () => {
  it('matches a single-day band (Fri 18:00-23:00)', () => {
    const w = { kind: 'recurring' as const, days: [5 as const], start: '18:00', end: '23:00' };
    expect(isWindowActive(w, at('2026-06-05T20:00:00Z'), UTC)).toBe(true); // Fri 20:00
    expect(isWindowActive(w, at('2026-06-05T17:00:00Z'), UTC)).toBe(false); // Fri 17:00
    expect(isWindowActive(w, at('2026-06-06T20:00:00Z'), UTC)).toBe(false); // Sat 20:00
  });

  it('treats an all-day weekend window correctly', () => {
    const w = { kind: 'recurring' as const, days: [0 as const, 6 as const], start: '00:00', end: '24:00' };
    expect(isWindowActive(w, at('2026-06-06T10:00:00Z'), UTC)).toBe(true); // Sat
    expect(isWindowActive(w, at('2026-06-07T23:00:00Z'), UTC)).toBe(true); // Sun
    expect(isWindowActive(w, at('2026-06-15T10:00:00Z'), UTC)).toBe(false); // Mon
  });

  it('handles a window that spans midnight (Fri 22:00-02:00)', () => {
    const w = { kind: 'recurring' as const, days: [5 as const], start: '22:00', end: '02:00' };
    expect(isWindowActive(w, at('2026-06-05T23:00:00Z'), UTC)).toBe(true); // Fri 23:00
    expect(isWindowActive(w, at('2026-06-06T01:00:00Z'), UTC)).toBe(true); // Sat 01:00 (Fri night)
    expect(isWindowActive(w, at('2026-06-06T03:00:00Z'), UTC)).toBe(false); // Sat 03:00
    expect(isWindowActive(w, at('2026-06-05T21:00:00Z'), UTC)).toBe(false); // Fri 21:00
  });
});

describe('date-range windows', () => {
  it('matches inclusive calendar dates', () => {
    const w = { kind: 'range' as const, startDate: '2026-06-01', endDate: '2026-06-30' };
    expect(isWindowActive(w, at('2026-06-15T12:00:00Z'), UTC)).toBe(true);
    expect(isWindowActive(w, at('2026-05-31T12:00:00Z'), UTC)).toBe(false);
    expect(isWindowActive(w, at('2026-07-01T12:00:00Z'), UTC)).toBe(false);
  });

  it('respects an optional daily time band within the range', () => {
    const w = { kind: 'range' as const, startDate: '2026-06-01', endDate: '2026-06-30', start: '18:00', end: '22:00' };
    expect(isWindowActive(w, at('2026-06-15T20:00:00Z'), UTC)).toBe(true);
    expect(isWindowActive(w, at('2026-06-15T23:00:00Z'), UTC)).toBe(false);
  });
});

describe('seasonal windows', () => {
  it('wraps the year-end (winter 12-01 → 02-28)', () => {
    const w = { kind: 'seasonal' as const, startMonthDay: '12-01', endMonthDay: '02-28' };
    expect(isWindowActive(w, at('2026-01-15T12:00:00Z'), UTC)).toBe(true);
    expect(isWindowActive(w, at('2026-12-15T12:00:00Z'), UTC)).toBe(true);
    expect(isWindowActive(w, at('2026-03-01T12:00:00Z'), UTC)).toBe(false);
    expect(isWindowActive(w, at('2026-07-10T12:00:00Z'), UTC)).toBe(false);
  });
});

describe('timezone correctness', () => {
  it('evaluates the same instant differently per restaurant timezone', () => {
    const inst = at('2026-06-05T22:30:00Z'); // Fri 22:30 UTC = Sat 01:30 Israel
    const satWindow: Schedule = { windows: [{ kind: 'recurring', days: [6], start: '01:00', end: '02:00' }] };
    const friWindow: Schedule = { windows: [{ kind: 'recurring', days: [5], start: '22:00', end: '23:00' }] };
    expect(isScheduleActive(satWindow, inst, 'Asia/Jerusalem')).toBe(true);
    expect(isScheduleActive(satWindow, inst, UTC)).toBe(false);
    expect(isScheduleActive(friWindow, inst, UTC)).toBe(true);
  });
});

describe('isScheduleActive (multiple windows)', () => {
  it('is active when ANY window matches', () => {
    const schedule: Schedule = {
      windows: [
        { kind: 'recurring', days: [5], start: '18:00', end: '23:00' }, // Fri eve
        { kind: 'seasonal', startMonthDay: '12-01', endMonthDay: '02-28' }, // winter
      ],
    };
    expect(isScheduleActive(schedule, at('2026-06-15T12:00:00Z'), UTC)).toBe(false); // Mon, summer
    expect(isScheduleActive(schedule, at('2026-06-05T20:00:00Z'), UTC)).toBe(true); // Fri eve
    expect(isScheduleActive(schedule, at('2026-01-15T12:00:00Z'), UTC)).toBe(true); // winter
  });
});
