import { describe, expect, test } from 'vitest';
import { parseCsv } from './parseCsv';

describe('parseCsv', () => {
  test('parses comma-separated slug/units/revenue rows', () => {
    // Arrange
    const csv = 'mojito,12,4200\nnegroni,8,3600';

    // Act
    const { rows, skipped } = parseCsv(csv);

    // Assert
    expect(rows).toEqual([
      { slug: 'mojito', units: 12, revenue: 4200 },
      { slug: 'negroni', units: 8, revenue: 3600 },
    ]);
    expect(skipped).toBe(0);
  });

  test('accepts tab-separated rows', () => {
    const { rows } = parseCsv('mojito\t5\t1500');
    expect(rows).toEqual([{ slug: 'mojito', units: 5, revenue: 1500 }]);
  });

  test('ignores blank lines and a header row', () => {
    const { rows, skipped } = parseCsv('slug,units,revenue\n\nmojito,1,10\n   \n');
    expect(rows).toEqual([{ slug: 'mojito', units: 1, revenue: 10 }]);
    expect(skipped).toBe(0);
  });

  test('drops rows with non-numeric amounts and counts them as skipped', () => {
    // Arrange — garbage numbers must NOT be silently coerced to a zero sale.
    const csv = 'mojito,abc,4200\nnegroni,8,3600';

    // Act
    const { rows, skipped } = parseCsv(csv);

    // Assert
    expect(rows).toEqual([{ slug: 'negroni', units: 8, revenue: 3600 }]);
    expect(skipped).toBe(1);
  });

  test('drops rows with negative amounts', () => {
    const { rows, skipped } = parseCsv('mojito,-5,100');
    expect(rows).toEqual([]);
    expect(skipped).toBe(1);
  });

  test('treats empty numeric cells as zero (revenue-only row is valid)', () => {
    const { rows, skipped } = parseCsv('mojito,,4200');
    expect(rows).toEqual([{ slug: 'mojito', units: 0, revenue: 4200 }]);
    expect(skipped).toBe(0);
  });

  test('skips a line that has no slug', () => {
    const { rows, skipped } = parseCsv(',5,100');
    expect(rows).toEqual([]);
    expect(skipped).toBe(1);
  });

  test('returns empty result for empty input', () => {
    expect(parseCsv('')).toEqual({ rows: [], skipped: 0 });
  });
});
