import { describe, it, expect } from 'vitest';
import { buildRecommendations } from './recommend';
import type { MenuEngineeringItem, MenuClass } from '../analytics/types';

const item = (over: Partial<MenuEngineeringItem> = {}): MenuEngineeringItem => ({
  slug: 'x',
  price: 60,
  cost: 18,
  margin: 42,
  marginPct: 70,
  views: 150,
  orders: 30,
  units: 40,
  conversionPct: 20,
  attentionScore: 60,
  klass: 'star' as MenuClass,
  highInterestLowConversion: false,
  ...over,
});

describe('buildRecommendations', () => {
  it('returns nothing for no items', () => {
    expect(buildRecommendations([])).toEqual([]);
  });

  it('flags a conversion leak with NO fabricated number', () => {
    const [rec] = buildRecommendations([item({ slug: 'negroni', highInterestLowConversion: true, attentionScore: 85, conversionPct: 2 })]);
    expect(rec.action).toBe('fix_offer');
    expect(rec.estimatedImpact).toBeUndefined(); // integrity gate: no invented %
    expect(rec.confidence).toBe('high'); // 150 views
  });

  it('gives a plowhorse a DERIVED profit estimate', () => {
    const [rec] = buildRecommendations([item({ slug: 'aperol', klass: 'plowhorse', units: 50, marginPct: 30 })]);
    expect(rec.action).toBe('raise_price');
    expect(rec.estimatedImpact?.en).toContain('+₪150'); // 50 units × ₪3
  });

  it('tells a puzzle to get more visibility, without a number', () => {
    const [rec] = buildRecommendations([item({ klass: 'puzzle', views: 100 })]);
    expect(rec.action).toBe('promote_position');
    expect(rec.estimatedImpact).toBeUndefined();
  });

  it('suppresses estimates and downgrades confidence on low data', () => {
    const [rec] = buildRecommendations([item({ klass: 'plowhorse', views: 10, units: 5 })]);
    expect(rec.confidence).toBe('low');
    expect(rec.estimatedImpact).toBeUndefined();
  });

  it('surfaces the leak before a star (priority sort)', () => {
    const recs = buildRecommendations([
      item({ slug: 'star', klass: 'star' }),
      item({ slug: 'leak', highInterestLowConversion: true }),
    ]);
    expect(recs[0].slug).toBe('leak');
    expect(recs[0].action).toBe('fix_offer');
  });
});
