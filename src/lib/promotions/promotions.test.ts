import { describe, it, expect } from 'vitest';
import {
  applyDiscount,
  isPromotionActive,
  promotionAppliesTo,
  priceFor,
  promotionBadges,
  resolvePromotions,
} from './promotions';
import type { Promotion } from './types';

const UTC = 'UTC';
const at = (iso: string) => new Date(iso);
const FRI_EVE = at('2026-06-05T20:00:00Z');
const MON = at('2026-06-15T12:00:00Z');

const pct = (value: number, over: Partial<Promotion> = {}): Promotion => ({
  id: 'p', name: 'Promo', type: 'percentage', value, scope: 'all', ...over,
});

describe('applyDiscount', () => {
  it('applies a percentage discount', () => {
    expect(applyDiscount(60, pct(20))).toBe(48);
  });
  it('applies a fixed discount and never goes below 0', () => {
    expect(applyDiscount(60, pct(10, { type: 'fixed' }))).toBe(50);
    expect(applyDiscount(60, pct(100, { type: 'fixed' }))).toBe(0);
  });
  it('clamps a percentage above 100', () => {
    expect(applyDiscount(60, pct(150))).toBe(0);
  });
});

describe('isPromotionActive', () => {
  it('uses the schedule (Friday happy hour)', () => {
    const p = pct(20, { schedule: { windows: [{ kind: 'recurring', days: [5], start: '18:00', end: '23:00' }] } });
    expect(isPromotionActive(p, FRI_EVE, UTC)).toBe(true);
    expect(isPromotionActive(p, MON, UTC)).toBe(false);
  });
  it('is always active with no schedule', () => {
    expect(isPromotionActive(pct(20), MON, UTC)).toBe(true);
  });
});

describe('promotionAppliesTo', () => {
  it('matches scope all / item / category', () => {
    expect(promotionAppliesTo(pct(10, { scope: 'all' }), { slug: 'x' })).toBe(true);
    expect(promotionAppliesTo(pct(10, { scope: 'item', targetSlugs: ['x'] }), { slug: 'x' })).toBe(true);
    expect(promotionAppliesTo(pct(10, { scope: 'item', targetSlugs: ['y'] }), { slug: 'x' })).toBe(false);
    expect(promotionAppliesTo(pct(10, { scope: 'category', targetCategories: ['gin'] }), { slug: 'x', category: 'gin' })).toBe(true);
    expect(promotionAppliesTo(pct(10, { scope: 'category', targetCategories: ['gin'] }), { slug: 'x', category: 'rum' })).toBe(false);
  });
});

describe('priceFor', () => {
  it('returns original price when no promo is active', () => {
    const p = pct(20, { schedule: { windows: [{ kind: 'recurring', days: [5], start: '18:00', end: '23:00' }] } });
    expect(priceFor(60, [p], { slug: 'x' }, MON, UTC)).toEqual({ price: 60, original: 60, discounted: false });
  });
  it('picks the lowest price among multiple active promos', () => {
    const a = pct(10, { id: 'a' }); // 60 -> 54
    const b = pct(25, { id: 'b' }); // 60 -> 45  (best)
    const res = priceFor(60, [a, b], { slug: 'x' }, MON, UTC);
    expect(res.price).toBe(45);
    expect(res.discounted).toBe(true);
    expect(res.promotion?.id).toBe('b');
  });
});

describe('promotionBadges', () => {
  it('defaults to happy_hour and honours a custom label', () => {
    const a = pct(20, { id: 'a' }); // default happy_hour
    const b = pct(20, { id: 'b', badgeKind: 'custom', badgeLabel: { en: 'Summer', he: 'קיץ' } });
    const badges = promotionBadges([a, b]);
    expect(badges.map((x) => x.kind)).toEqual(['happy_hour', 'custom']);
    expect(badges[1].label).toEqual({ en: 'Summer', he: 'קיץ' });
  });
});

describe('resolvePromotions', () => {
  it('returns final price + badges together', () => {
    const happy = pct(25, {
      id: 'hh', badgeKind: 'happy_hour',
      schedule: { windows: [{ kind: 'recurring', days: [5], start: '18:00', end: '23:00' }] },
    });
    const live = resolvePromotions(60, [happy], { slug: 'x' }, FRI_EVE, UTC);
    expect(live.priced.price).toBe(45);
    expect(live.badges.map((b) => b.kind)).toEqual(['happy_hour']);

    const off = resolvePromotions(60, [happy], { slug: 'x' }, MON, UTC);
    expect(off.priced.discounted).toBe(false);
    expect(off.badges).toEqual([]);
  });
});
