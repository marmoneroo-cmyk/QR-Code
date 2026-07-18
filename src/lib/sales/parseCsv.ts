import type { SaleInput } from './repository';

export interface ParsedSalesCsv {
  /** Rows that parsed cleanly and are safe to import. */
  rows: SaleInput[];
  /** Count of non-empty, non-header lines that were dropped as malformed. */
  skipped: number;
}

/** A number field is valid when absent/empty (→ 0) or a finite, non-negative number. */
function readAmount(raw: string | undefined): { ok: boolean; value: number } {
  if (raw === undefined || raw === '') return { ok: true, value: 0 };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { ok: false, value: 0 };
  return { ok: true, value: n };
}

/**
 * Parse pasted/uploaded sales data (comma- or tab-separated: `slug, units, revenue`).
 *
 * Robust by design: a header row and blank lines are ignored, and any line whose
 * numeric fields contain garbage (non-numeric or negative) is DROPPED and counted in
 * `skipped` rather than silently coerced to a zero-value sale. Empty numeric cells are
 * still treated as 0, so `mojito,,4200` remains a legitimate revenue-only row. The
 * caller surfaces `skipped` so the operator knows their file wasn't fully imported.
 */
export function parseCsv(text: string): ParsedSalesCsv {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^slug/i.test(l));

  const rows: SaleInput[] = [];
  let skipped = 0;

  for (const line of lines) {
    const [slug, unitsRaw, revenueRaw] = line.split(/[,\t]/).map((s) => s.trim());
    const units = readAmount(unitsRaw);
    const revenue = readAmount(revenueRaw);

    if (!slug || !units.ok || !revenue.ok) {
      skipped++;
      continue;
    }

    rows.push({ slug, units: units.value, revenue: revenue.value });
  }

  return { rows, skipped };
}
