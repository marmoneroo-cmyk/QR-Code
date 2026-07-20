/**
 * Boundary validation for the shared scheduling primitive.
 *
 * Every schedulable feature (Menu Experience modules, badges, and the Promotions Engine)
 * persists a `Schedule` as JSON and re-serves it to anonymous diners, where it is then
 * EVALUATED on each menu render. So a stored schedule must be two things:
 *
 *  1. Evaluatable — `windows` must really be an array. A value like `{}` or
 *     `{windows: null}` satisfies "is an object" but makes the evaluator read
 *     `.length` off undefined, which throws on every render.
 *  2. Bounded — it is stored payload that gets handed out publicly.
 *
 * Individual window CONTENTS are deliberately not deep-validated: the evaluator already
 * ignores unknown window kinds safely (its switch falls through to `false`), so the
 * safety-critical invariant is the bounded array, not each field.
 */

export const MAX_WINDOWS = 60;

export function isSchedule(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const schedule = value as Record<string, unknown>;
  if (!Array.isArray(schedule.windows)) return false;
  if (schedule.windows.length > MAX_WINDOWS) return false;
  return schedule.windows.every((w) => typeof w === 'object' && w !== null);
}
