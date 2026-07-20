import type { SaleInput } from './repository';

// Hard cap on a single import batch — guards against unbounded-payload abuse.
export const MAX_SALES_ROWS = 1000;
// Sales rows are persisted, so the slug is bounded like every other stored slug
// in the app (promotions targetSlugs, the public track ingest) rather than left
// limited only by whatever the surrounding request cap happens to be.
export const MAX_SLUG_LEN = 120;

export function isValidSaleInput(row: unknown): row is SaleInput {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.slug === 'string' &&
    r.slug.trim().length > 0 &&
    r.slug.length <= MAX_SLUG_LEN &&
    typeof r.units === 'number' &&
    Number.isFinite(r.units) &&
    r.units >= 0 &&
    typeof r.revenue === 'number' &&
    Number.isFinite(r.revenue) &&
    r.revenue >= 0
  );
}
