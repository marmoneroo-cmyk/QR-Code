import { describe, expect, it, vi } from 'vitest';
import { fetchAllEvents } from './fetchEvents';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * Mock that serves rows in PostgREST-style pages: `.range(from, to)` returns at
 * most that slice, and never more than 1000 (the server max-rows cap) — exactly
 * the condition that made a plain `.limit(50000)` silently truncate.
 */
function pagedClient(allRows: Array<Record<string, unknown>>, opts: { erroring?: boolean } = {}) {
  const calls: Array<[number, number]> = [];
  const makeBuilder = () => {
    let lo = 0;
    let hi = 0;
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      range: (from: number, to: number) => {
        lo = from;
        hi = to;
        calls.push([from, to]);
        if (opts.erroring) return Promise.resolve({ data: null, error: { message: 'boom' } });
        // Cap each page at 1000 rows like the real server, regardless of the span.
        const end = Math.min(hi + 1, lo + 1000);
        return Promise.resolve({ data: allRows.slice(lo, end), error: null });
      },
    };
    return builder;
  };
  const client = { from: () => makeBuilder() } as unknown as SupabaseServerClient;
  return { client, calls };
}

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

describe('fetchAllEvents', () => {
  it('returns every row for a dataset larger than one page', async () => {
    const { client, calls } = pagedClient(rows(2500));
    const out = await fetchAllEvents(client, 'r1', 'id');

    expect(out).toHaveLength(2500); // NOT capped at 1000
    expect(out.map((r) => (r as { id: number }).id).at(-1)).toBe(2499);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]); // three pages, then a short final page stops the loop
  });

  it('stops after one page when the dataset fits', async () => {
    const { client, calls } = pagedClient(rows(42));
    const out = await fetchAllEvents(client, 'r1', 'id');

    expect(out).toHaveLength(42);
    expect(calls).toHaveLength(1); // short first page → no wasted round trip
  });

  it('returns empty for no rows', async () => {
    const { client } = pagedClient(rows(0));
    expect(await fetchAllEvents(client, 'r1', 'id')).toEqual([]);
  });

  it('throws when a page errors, so callers can fall back', async () => {
    const { client } = pagedClient(rows(10), { erroring: true });
    await expect(fetchAllEvents(client, 'r1', 'id')).rejects.toThrow('boom');
  });

  it('honors a hardCap so a runaway dataset cannot read unbounded rows', async () => {
    const { client, calls } = pagedClient(rows(5000));
    const out = await fetchAllEvents(client, 'r1', 'id', { hardCap: 2000 });

    expect(out).toHaveLength(2000); // stops at the ceiling
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });
});
