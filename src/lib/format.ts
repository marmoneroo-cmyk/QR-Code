/**
 * Tiny shared formatting helpers with no React/runtime dependencies, so they are safe
 * to import from both client components and server-only modules. `formatILS` was
 * previously copy-pasted (with one inconsistent variant missing `.toLocaleString()`)
 * across `components/ui/value`, five `admin/*` pages, and `lib/optimization/recommend`.
 */

/** Format a number of Israeli shekels as `₪1,234` (rounded, thousands-grouped). */
export function formatILS(n: number): string {
  return `₪${Math.round(n).toLocaleString()}`;
}
