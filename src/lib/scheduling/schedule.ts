import type {
  Schedule,
  ScheduleWindow,
  RecurringWindow,
  DateRangeWindow,
  SeasonalWindow,
  TimeOfDay,
  Weekday,
} from './types';

/** A schedule that is always active. */
export const ALWAYS: Schedule = { windows: [] };

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: Weekday;
  minutes: number; // minutes since local midnight (0-1439)
}

const WEEKDAY_INDEX: Record<string, Weekday> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Restaurant-local wall-clock parts of `now` in IANA `tz`, DST-correct via Intl.
 * This is the single place timezone math happens.
 */
export function localParts(now: Date, tz: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(now);

  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const hour = parseInt(get('hour'), 10) % 24; // guard h24 edge
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
    minutes: hour * 60 + parseInt(get('minute'), 10),
  };
}

function toMinutes(t: TimeOfDay): number {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function inDailyBand(nowMin: number, start?: TimeOfDay, end?: TimeOfDay): boolean {
  const s = start ? toMinutes(start) : 0;
  const e = end ? toMinutes(end) : 24 * 60;
  if (e <= s) return nowMin >= s || nowMin < e; // spans midnight
  return nowMin >= s && nowMin < e;
}

function matchRecurring(w: RecurringWindow, p: LocalParts): boolean {
  const s = toMinutes(w.start);
  const e = toMinutes(w.end);
  const dayOk = w.days.length === 0 || w.days.includes(p.weekday);
  if (e > s) return dayOk && p.minutes >= s && p.minutes < e;
  // spans midnight: the window opened on its day and runs past 00:00 into the next day
  const prevDay = ((p.weekday + 6) % 7) as Weekday;
  const prevOk = w.days.length === 0 || w.days.includes(prevDay);
  return (dayOk && p.minutes >= s) || (prevOk && p.minutes < e);
}

function asYmd(p: LocalParts): number {
  return p.year * 10000 + p.month * 100 + p.day;
}
function parseYmd(s: string): number {
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  return y * 10000 + m * 100 + d;
}

function matchRange(w: DateRangeWindow, p: LocalParts): boolean {
  const today = asYmd(p);
  if (today < parseYmd(w.startDate) || today > parseYmd(w.endDate)) return false;
  return inDailyBand(p.minutes, w.start, w.end);
}

function asMd(p: LocalParts): number {
  return p.month * 100 + p.day;
}
function parseMd(s: string): number {
  const [m, d] = s.split('-').map((n) => parseInt(n, 10));
  return m * 100 + d;
}

function matchSeasonal(w: SeasonalWindow, p: LocalParts): boolean {
  const cur = asMd(p);
  const s = parseMd(w.startMonthDay);
  const e = parseMd(w.endMonthDay);
  if (s <= e) return cur >= s && cur <= e;
  return cur >= s || cur <= e; // wraps the year-end
}

/** Is a single window active at `now` in the restaurant timezone `tz`? */
export function isWindowActive(window: ScheduleWindow, now: Date, tz: string): boolean {
  const p = localParts(now, tz);
  switch (window.kind) {
    case 'recurring':
      return matchRecurring(window, p);
    case 'range':
      return matchRange(window, p);
    case 'seasonal':
      return matchSeasonal(window, p);
    default:
      return false;
  }
}

/**
 * Is the schedule active right now (restaurant timezone)?
 * Empty / null / undefined => always active.
 */
export function isScheduleActive(
  schedule: Schedule | null | undefined,
  now: Date,
  tz: string,
): boolean {
  if (!schedule || schedule.windows.length === 0) return true;
  return schedule.windows.some((w) => isWindowActive(w, now, tz));
}
