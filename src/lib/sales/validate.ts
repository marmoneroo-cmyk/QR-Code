import type { SaleInput } from './repository';

// Hard cap on a single import batch — guards against unbounded-payload abuse.
export const MAX_SALES_ROWS = 1000;

export function isValidSaleInput(row: unknown): row is SaleInput {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.slug === 'string' &&
    r.slug.trim().length > 0 &&
    typeof r.units === 'number' &&
    Number.isFinite(r.units) &&
    typeof r.revenue === 'number' &&
    Number.isFinite(r.revenue)
  );
}
