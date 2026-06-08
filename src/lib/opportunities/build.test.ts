import { describe, it, expect } from 'vitest';
import { buildOpportunities } from './build';
import type { ItemSignals, MenuSignals, LayoutInsight, Opportunity } from './types';

const LAYOUT: LayoutInsight = {
  sessions: 0,
  reachedFirst3Pct: 0,
  reachedHalfPct: 0,
  reachedAllPct: 0,
  rarelyReached: [],
  categoryReach: [],
};

const item = (over: Partial<ItemSignals> = {}): ItemSignals => ({
  slug: 'x',
  position: 0,
  impressions: 0,
  opens: 0,
  dwellAvgMs: 0,
  shares: 0,
  favorites: 0,
  returningOpens: 0,
  repeatNoCommit: 0,
  salesUnits: 0,
  salesRevenue: 0,
  ...over,
});

const signals = (items: ItemSignals[]): MenuSignals => ({ items, layout: LAYOUT, hasData: items.length > 0 });
const types = (o: Opportunity[]) => o.map((x) => x.type);
const noFabricatedNumber = (o: Opportunity) => !/\d/.test(o.action.en) && !/\d/.test(o.action.he);

describe('buildOpportunities', () => {
  it('returns nothing without items', () => {
    expect(buildOpportunities(signals([]))).toEqual([]);
  });

  it('flags high-engagement / low-intent as fix_offer (no fabricated number)', () => {
    const out = buildOpportunities(signals([item({ slug: 'negroni', opens: 30, impressions: 40, favorites: 1 })]));
    expect(types(out)).toContain('fix_offer');
    const rec = out.find((o) => o.type === 'fix_offer')!;
    expect(rec.confidence).toBe('high');
    expect(noFabricatedNumber(rec)).toBe(true);
    expect(rec.evidence.length).toBeGreaterThan(0);
  });

  it('flags buried-but-loved as promote_position using menu position', () => {
    const out = buildOpportunities(
      signals([
        item({ slug: 'buried', position: 1, impressions: 4, opens: 3, favorites: 2 }),
        item({ slug: 'top', position: 0, impressions: 40, opens: 0 }),
      ]),
    );
    const rec = out.find((o) => o.slug === 'buried');
    expect(rec?.type).toBe('promote_position');
    expect(rec?.evidence.some((e) => e.value.includes('#'))).toBe(true); // position cited
  });

  it('flags high-share / no-sales as promote_marketing', () => {
    const out = buildOpportunities(signals([item({ opens: 20, impressions: 25, shares: 4, favorites: 5 })]));
    expect(types(out)).toContain('promote_marketing');
  });

  it('flags returning-visitor engagement as promotion_candidate', () => {
    const out = buildOpportunities(signals([item({ impressions: 100, opens: 10, returningOpens: 5, favorites: 1 })]));
    expect(types(out)).toContain('promotion_candidate');
  });

  it('flags repeat-without-commit as reengage_returning', () => {
    const out = buildOpportunities(signals([item({ repeatNoCommit: 3 })]));
    expect(types(out)).toEqual(['reengage_returning']);
  });

  it('never reports an open rate above 100% (impressions can undercount)', () => {
    const out = buildOpportunities(signals([item({ slug: 'aperol', opens: 10, impressions: 7 })]));
    const rec = out.find((o) => o.type === 'fix_offer');
    const openRate = rec?.evidence.find((e) => e.label.en === 'Open rate');
    expect(openRate?.value).toBe('100%');
  });

  it('sorts higher-confidence / higher-weight opportunities first', () => {
    const out = buildOpportunities(
      signals([
        item({ slug: 'weak', repeatNoCommit: 2 }), // low weight, low conf
        item({ slug: 'leak', opens: 40, impressions: 50, favorites: 1 }), // fix_offer, high conf
      ]),
    );
    expect(out[0].slug).toBe('leak');
  });
});
