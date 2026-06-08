/**
 * Scheduling core — the ONE time-window primitive shared by every schedulable
 * feature (Menu Experience modules, badges, and the Promotions Engine).
 *
 * Design rules:
 * - Evaluated in the RESTAURANT's timezone, never the guest's device clock.
 * - `now` is always injected (pure functions) so behaviour is fully testable.
 * - A schedule with no windows is "always active" (the feature's own enabled
 *   flag decides IF it runs; the schedule decides WHEN).
 */

/** 0 = Sunday … 6 = Saturday (matches `Date.getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** "HH:MM" 24-hour, restaurant-local wall clock. "24:00" = end of day. */
export type TimeOfDay = string;

/**
 * Recurring weekly window — e.g. Fri 18:00–23:00, or weekends all day.
 * If `end <= start` the window spans midnight (e.g. 22:00–02:00).
 */
export interface RecurringWindow {
  kind: 'recurring';
  /** Days the window applies to. Empty = every day. */
  days: Weekday[];
  start: TimeOfDay; // inclusive
  end: TimeOfDay; // exclusive
}

/** Absolute calendar range (inclusive dates), with an optional daily time band. */
export interface DateRangeWindow {
  kind: 'range';
  startDate: string; // "YYYY-MM-DD" inclusive, restaurant-local
  endDate: string; // "YYYY-MM-DD" inclusive
  start?: TimeOfDay; // optional daily start (default 00:00)
  end?: TimeOfDay; // optional daily end (default 24:00)
}

/** Seasonal month/day window; wraps the year-end if `start > end` (e.g. 12-01 → 02-28). */
export interface SeasonalWindow {
  kind: 'seasonal';
  startMonthDay: string; // "MM-DD" inclusive
  endMonthDay: string; // "MM-DD" inclusive
}

export type ScheduleWindow = RecurringWindow | DateRangeWindow | SeasonalWindow;

export interface Schedule {
  /** Active when ANY window matches. Empty = always active. */
  windows: ScheduleWindow[];
}
