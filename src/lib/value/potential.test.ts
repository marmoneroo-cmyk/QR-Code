import { describe, it, expect } from 'vitest';
import { buildMenuBenchmark, estimatePotential, totalPotential } from './potential';
import type { MenuEngineeringItem } from '../analytics/types';

const item = (over: Partial<MenuEngineeringItem> = {}): MenuEngineeringItem => ({
  slug: 'x',
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

const bench = { medianConversionPct: 20, medianViews: 100 };

describe('estimatePotential — integrity guards', () => {
  it('returns null when traffic is too small to estimate (no fabrication)', () => {
    expect(estimatePotential(item({ views: 5 }), bench)).toBeNull();
  });

  it('returns null when there is no clear upside (already above benchmark)', () => {
    expect(estimatePotential(item({ conversionPct: 35, views: 100 }), bench)).toBeNull();
  });

  it('returns null when price is non-positive', () => {
    expect(estimatePotential(item({ price: 0 }), bench)).toBeNull();
  });
});

describe('estimatePotential — conversion lever', () => {
  it('estimates closing the conversion gap to the menu median', () => {
    // views 100, conv 10% → median 20% ⇒ gap 0.10 ⇒ +10 orders
    const p = estimatePotential(item({ conversionPct: 10, views: 100 }), bench);
    expect(p).not.toBeNull();
    expect(p!.lever).toBe('conversion');
    expect(p!.extraOrders).toBe(10);
    expect(p!.revenueILS).toBe(500); // 10 × ₪50
    expect(p!.profitILS).toBe(300); // 10 × ₪30
  });

  it('scales confidence with sample size, not with the number', () => {
    expect(estimatePotential(item({ views: 10 }), bench)!.confidence).toBe('low');
    expect(estimatePotential(item({ views: 20 }), bench)!.confidence).toBe('medium');
    expect(estimatePotential(item({ views: 60 }), bench)!.confidence).toBe('high');
  });
});

describe('estimatePotential — visibility lever', () => {
  it('estimates raising views to the median at the current conversion', () => {
    // already at/above median conversion but only 40 views vs median 100 → +60 views × 20% = +12 orders
    const p = estimatePotential(item({ conversionPct: 20, views: 40 }), { medianConversionPct: 20, medianViews: 100 });
    expect(p).not.toBeNull();
    expect(p!.lever).toBe('visibility');
    expect(p!.extraOrders).toBe(12);
    expect(p!.revenueILS).toBe(600);
  });
});

describe('buildMenuBenchmark', () => {
  it('uses median conversion of items with real traffic and median views overall', () => {
    const items = [
      item({ slug: 'a', views: 100, conversionPct: 10 }),
      item({ slug: 'b', views: 50, conversionPct: 30 }),
      item({ slug: 'c', views: 3, conversionPct: 99 }), // excluded from conversion (no traffic)
    ];
    const b = buildMenuBenchmark(items);
    expect(b.medianConversionPct).toBe(20); // median of [10, 30]
    expect(b.medianViews).toBe(50); // median of [100, 50, 3]
  });
});

describe('totalPotential', () => {
  it('sums only quantified upsides and counts them', () => {
    // median conversion of [5, 25] = 15; 'a' is below it → upside, 'b' above → none,
    // 'c' has no real traffic → ignored entirely.
    const items = [
      item({ slug: 'a', views: 200, conversionPct: 5 }),
      item({ slug: 'b', views: 200, conversionPct: 25 }),
      item({ slug: 'c', views: 4, conversionPct: 5 }),
    ];
    const tp = totalPotential(items);
    expect(tp.count).toBe(1);
    expect(tp.revenueILS).toBeGreaterThan(0);
  });
});
