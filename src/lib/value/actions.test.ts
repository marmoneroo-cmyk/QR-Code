import { describe, it, expect } from 'vitest';
import { buildActions } from './actions';
import type { Opportunity } from '../opportunities/types';
import type { MenuEngineeringItem } from '../analytics/types';

const item = (slug: string, over: Partial<MenuEngineeringItem> = {}): MenuEngineeringItem => ({
  slug,
  price: 50,
  cost: 20,
  margin: 30,
  marginPct: 60,
  views: 100,
  orders: 10,
  units: 10,
  conversionPct: 10,
  attentionScore: 50,
  klass: 'puzzle',
  highInterestLowConversion: false,
  ...over,
});

const opp = (slug: string, over: Partial<Opportunity> = {}): Opportunity => ({
  slug,
  type: 'fix_offer',
  confidence: 'high',
  evidence: [{ label: { en: 'Searches', he: 'חיפושים' }, value: '42' }],
  action: { en: `Fix ${slug}`, he: `תקנו ${slug}` },
  priority: 1,
  ...over,
});

const bench = { medianConversionPct: 20, medianViews: 100 };

describe('buildActions', () => {
  it('maps an opportunity into a concrete action with value, effort, confidence, execute path', () => {
    const items = new Map([['a', item('a', { conversionPct: 10, views: 100 })]]);
    const [action] = buildActions([opp('a')], items, bench);
    expect(action.id).toBe('a:fix_offer');
    expect(action.valueILS).toBe(500); // +10 orders × ₪50
    expect(action.effortMin).toBe(5); // fix_offer
    expect(action.confidencePct).toBe(59); // high @ 100 views — sample-driven (100/160 × 0.95), not a fixed lookup
    expect(action.executeHref).toBe('/admin/a/edit');
    expect(action.why[0].value).toBe('42');
  });

  it('routes promotion-type actions to the prefilled promotions screen', () => {
    const items = new Map([['b', item('b', { conversionPct: 5, views: 100 })]]);
    const [action] = buildActions([opp('b', { type: 'promote_position' })], items, bench);
    expect(action.executeHref).toBe('/admin/promotions?cocktail=b');
  });

  it('ranks by estimated ₪ value (desc), nulls last', () => {
    const items = new Map([
      ['big', item('big', { conversionPct: 2, views: 200, price: 80 })],
      ['small', item('small', { conversionPct: 18, views: 100 })],
      ['none', item('none', { views: 4 })], // too little data → null value
    ]);
    const ranked = buildActions(
      [opp('small'), opp('big'), opp('none')],
      items,
      bench,
    );
    expect(ranked.map((a) => a.slug)).toEqual(['big', 'small', 'none']);
    expect(ranked[2].valueILS).toBeNull();
  });

  it('carries null value when there is no menu-engineering row for the slug', () => {
    const [action] = buildActions([opp('ghost')], new Map(), bench);
    expect(action.valueILS).toBeNull();
    expect(action.potential).toBeNull();
  });

  it('derives confidence from the real sample — more views ⇒ more confidence; no data ⇒ 0', () => {
    const small = buildActions([opp('a')], new Map([['a', item('a', { views: 30 })]]), bench)[0];
    const big = buildActions([opp('a')], new Map([['a', item('a', { views: 2000 })]]), bench)[0];
    expect(big.confidencePct).toBeGreaterThan(small.confidencePct);
    expect(big.confidencePct).toBeLessThanOrEqual(95); // honest ceiling — never certainty
    // Same sample, weaker qualitative separation ⇒ lower confidence.
    const low = buildActions([opp('a', { confidence: 'low' })], new Map([['a', item('a', { views: 2000 })]]), bench)[0];
    expect(low.confidencePct).toBeLessThan(big.confidencePct);
    // No menu-engineering row at all ⇒ zero observed sample ⇒ 0% (never fake certainty).
    const ghost = buildActions([opp('ghost')], new Map(), bench)[0];
    expect(ghost.confidencePct).toBe(0);
  });
});
