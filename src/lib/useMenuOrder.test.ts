import { describe, it, expect } from 'vitest';
import { applyOrder } from './useMenuOrder';

const items = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }, { slug: 'd' }];

describe('applyOrder', () => {
  it('returns items unchanged (identity) when order is empty', () => {
    expect(applyOrder(items, [])).toEqual(items);
  });

  it('reorders fully-listed items into the given sequence', () => {
    expect(applyOrder(items, ['c', 'a', 'd', 'b']).map((x) => x.slug)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('puts ranked items first (in order) and keeps unranked in original relative order', () => {
    // only b and d are ranked → b, d first; a, c keep original relative order after
    expect(applyOrder(items, ['d', 'b']).map((x) => x.slug)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('ignores slugs in order that are not present in items', () => {
    expect(applyOrder(items, ['ghost', 'b', 'a']).map((x) => x.slug)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('does not mutate the input array', () => {
    const input = [...items];
    applyOrder(input, ['d', 'c']);
    expect(input.map((x) => x.slug)).toEqual(['a', 'b', 'c', 'd']);
  });
});
