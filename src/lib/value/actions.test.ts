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
    expect(action.confidencePct).toBe(91); // high
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
});
