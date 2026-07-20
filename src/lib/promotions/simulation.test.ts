import { describe, it, expect } from 'vitest';
import {
  isPromotionActive,
  promotionAppliesTo,
  activePromotionsFor,
  applyDiscount,
  priceFor,
  promotionBadges,
  resolvePromotions,
} from './promotions';
import type { Promotion, PromotableItem } from './types';
import type { Schedule, Weekday } from '../scheduling/types';

/**
 * Full-menu promotions SIMULATION.
 *
 * Drives the real pricing engine over a 20-item menu crossed with a promotion
 * matrix (every discount type, value edge, scope, and schedule shape) at hourly
 * time points across a full week — including midnight-spanning happy hours and a
 * DST transition. It asserts the INVARIANTS a guest-facing price must never break
 * (never negative, never above original, flag consistent with the number), rather
 * than hard-coding expected outputs, so it catches regressions anywhere in the
 * chain promotions -> scheduling -> badges.
 */

const TZ = 'Asia/Jerusalem';

// ---------------------------------------------------------------------------
// 20-item menu — varied categories and price edges (0, sub-shekel, typical, large)
// ---------------------------------------------------------------------------
const CATEGORIES = ['cocktails', 'mains', 'desserts', 'sides'] as const;

const MENU: { item: PromotableItem; price: number }[] = Array.from({ length: 20 }, (_, i) => ({
  item: {
    slug: `sim-item-${i}`,
    // leave a couple of items category-less to exercise the `category` scope guard
    category: i % 7 === 0 ? undefined : CATEGORIES[i % CATEGORIES.length],
  },
  price: [0, 0.5, 1, 12.5, 42, 52, 54, 56, 58, 62, 68, 96, 100, 149.99, 250, 7.77, 33.33, 19.9, 8, 999.99][i],
}));

// ---------------------------------------------------------------------------
// Schedule shapes
// ---------------------------------------------------------------------------
const ALWAYS_UNDEF = undefined;
const ALWAYS_EMPTY: Schedule = { windows: [] };
const NORMAL_BAND: Schedule = { windows: [{ kind: 'recurring', days: [5], start: '18:00', end: '23:00' }] };
const SPANS_MIDNIGHT: Schedule = { windows: [{ kind: 'recurring', days: [5], start: '22:00', end: '02:00' }] };
const EVERY_DAY_MIDNIGHT: Schedule = { windows: [{ kind: 'recurring', days: [], start: '22:00', end: '02:00' }] };
const FULL_DAY: Schedule = { windows: [{ kind: 'recurring', days: [], start: '00:00', end: '24:00' }] };
const DATE_RANGE: Schedule = {
  windows: [{ kind: 'range', startDate: '2026-07-01', endDate: '2026-07-31', start: '10:00', end: '14:00' }],
};
const SEASONAL_WRAP: Schedule = { windows: [{ kind: 'seasonal', startMonthDay: '12-01', endMonthDay: '02-28' }] };
const SEASONAL_PLAIN: Schedule = { windows: [{ kind: 'seasonal', startMonthDay: '06-01', endMonthDay: '08-31' }] };

const SCHEDULES: { label: string; schedule?: Schedule }[] = [
  { label: 'always(undefined)', schedule: ALWAYS_UNDEF },
  { label: 'always(empty)', schedule: ALWAYS_EMPTY },
  { label: 'recurring-normal', schedule: NORMAL_BAND },
  { label: 'recurring-spans-midnight', schedule: SPANS_MIDNIGHT },
  { label: 'recurring-everyday-midnight', schedule: EVERY_DAY_MIDNIGHT },
  { label: 'recurring-full-day', schedule: FULL_DAY },
  { label: 'date-range', schedule: DATE_RANGE },
  { label: 'seasonal-wrap', schedule: SEASONAL_WRAP },
  { label: 'seasonal-plain', schedule: SEASONAL_PLAIN },
];

// ---------------------------------------------------------------------------
// Promotion matrix — every type x value edge x scope
// ---------------------------------------------------------------------------
const PCT_VALUES = [0, 1, 25, 50, 99, 100, 101, 150, -10];
const FIXED_VALUES = [0, 1, 10, 50, 96, 1000, -5];

function buildPromotions(): Promotion[] {
  const out: Promotion[] = [];
  let n = 0;
  for (const { label, schedule } of SCHEDULES) {
    for (const value of PCT_VALUES) {
      out.push({
        id: `pct-${n++}`,
        name: `pct ${value} ${label}`,
        type: 'percentage',
        value,
        scope: 'all',
        schedule,
      });
    }
    for (const value of FIXED_VALUES) {
      out.push({
        id: `fix-${n++}`,
        name: `fixed ${value} ${label}`,
        type: 'fixed',
        value,
        scope: 'all',
        schedule,
      });
    }
  }
  // scope variants
  out.push({ id: 'scope-item', name: 'item scoped', type: 'percentage', value: 20, scope: 'item', targetSlugs: ['sim-item-1', 'sim-item-2'] });
  out.push({ id: 'scope-item-empty', name: 'item scoped empty', type: 'percentage', value: 20, scope: 'item', targetSlugs: [] });
  out.push({ id: 'scope-item-missing', name: 'item scoped missing', type: 'percentage', value: 20, scope: 'item' });
  out.push({ id: 'scope-cat', name: 'cat scoped', type: 'percentage', value: 30, scope: 'category', targetCategories: ['cocktails'] });
  out.push({ id: 'scope-cat-missing', name: 'cat scoped missing', type: 'percentage', value: 30, scope: 'category' });
  // badge variants
  out.push({ id: 'badge-custom-a', name: 'custom a', type: 'percentage', value: 5, scope: 'all', badgeKind: 'custom', badgeLabel: { en: 'A', he: 'א' } });
  out.push({ id: 'badge-custom-b', name: 'custom b', type: 'percentage', value: 5, scope: 'all', badgeKind: 'custom', badgeLabel: { en: 'B', he: 'ב' } });
  out.push({ id: 'badge-dupe-1', name: 'dupe 1', type: 'percentage', value: 5, scope: 'all', badgeKind: 'happy_hour' });
  out.push({ id: 'badge-dupe-2', name: 'dupe 2', type: 'percentage', value: 6, scope: 'all', badgeKind: 'happy_hour' });
  return out;
}

const PROMOTIONS = buildPromotions();

/** Hourly sweep across a full week + a DST-transition week. */
function timePoints(): Date[] {
  const out: Date[] = [];
  // A full week in July 2026 (Sun 2026-07-12 .. Sat 2026-07-18), every hour, UTC-based
  for (let d = 12; d <= 18; d++) {
    for (let h = 0; h < 24; h++) {
      out.push(new Date(Date.UTC(2026, 6, d, h, 0, 0)));
    }
  }
  // DST transition weekend (Israel switches late Oct) + year-end for seasonal wrap
  for (const iso of ['2026-10-24T22:30:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-12-31T21:00:00Z', '2027-01-01T00:30:00Z', '2026-02-14T12:00:00Z']) {
    out.push(new Date(iso));
  }
  return out;
}

const TIMES = timePoints();

describe('promotions simulation — 20-item menu x promotion matrix x weekly time sweep', () => {
  it('never produces an invalid guest-facing price', () => {
    const violations: string[] = [];

    for (const now of TIMES) {
      for (const { item, price } of MENU) {
        const priced = priceFor(price, PROMOTIONS, item, now, TZ);

        if (!Number.isFinite(priced.price)) {
          violations.push(`non-finite price ${priced.price} for ${item.slug} @ ${now.toISOString()}`);
        }
        if (priced.price < 0) {
          violations.push(`negative price ${priced.price} for ${item.slug} @ ${now.toISOString()}`);
        }
        if (priced.price > priced.original) {
          violations.push(`price ${priced.price} > original ${priced.original} for ${item.slug} @ ${now.toISOString()}`);
        }
        if (priced.original !== price) {
          violations.push(`original ${priced.original} !== input ${price} for ${item.slug}`);
        }
        // the discounted flag must agree with the number
        if (priced.discounted !== priced.price < priced.original) {
          violations.push(
            `flag mismatch discounted=${priced.discounted} price=${priced.price} original=${priced.original} for ${item.slug} @ ${now.toISOString()}`,
          );
        }
        // a discount must name the promotion that produced it, and that promo must be genuinely active
        if (priced.discounted) {
          if (!priced.promotion) {
            violations.push(`discounted with no promotion for ${item.slug} @ ${now.toISOString()}`);
          } else {
            const active = activePromotionsFor(PROMOTIONS, item, now, TZ);
            if (!active.some((p) => p.id === priced.promotion?.id)) {
              violations.push(`winning promo ${priced.promotion.id} not in active set for ${item.slug} @ ${now.toISOString()}`);
            }
          }
        }
      }
    }

    expect(violations.slice(0, 20)).toEqual([]);
    // Deliberately generous: this is a brute-force sweep (hundreds of thousands of
    // schedule evaluations), so it must not turn flaky on a loaded machine.
  }, 30_000);

  it('only ever applies promotions that both target the item and are live', () => {
    const violations: string[] = [];
    for (const now of TIMES.slice(0, 72)) {
      for (const { item } of MENU) {
        for (const p of activePromotionsFor(PROMOTIONS, item, now, TZ)) {
          if (!promotionAppliesTo(p, item)) violations.push(`${p.id} does not target ${item.slug}`);
          if (!isPromotionActive(p, now, TZ)) violations.push(`${p.id} not live @ ${now.toISOString()}`);
        }
      }
    }
    expect(violations.slice(0, 20)).toEqual([]);
    // Deliberately generous: this is a brute-force sweep (hundreds of thousands of
    // schedule evaluations), so it must not turn flaky on a loaded machine.
  }, 30_000);

  it('picks the single best (lowest) price among active promotions', () => {
    const violations: string[] = [];
    for (const now of TIMES.slice(0, 72)) {
      for (const { item, price } of MENU) {
        const active = activePromotionsFor(PROMOTIONS, item, now, TZ);
        const best = active.reduce((lo, p) => Math.min(lo, applyDiscount(price, p)), price);
        const priced = priceFor(price, PROMOTIONS, item, now, TZ);
        if (priced.price !== best) {
          violations.push(`best mismatch got ${priced.price} expected ${best} for ${item.slug} @ ${now.toISOString()}`);
        }
      }
    }
    expect(violations.slice(0, 20)).toEqual([]);
    // Deliberately generous: this is a brute-force sweep (hundreds of thousands of
    // schedule evaluations), so it must not turn flaky on a loaded machine.
  }, 30_000);

  it('resolvePromotions stays consistent with its parts', () => {
    const violations: string[] = [];
    for (const now of TIMES.slice(0, 48)) {
      for (const { item, price } of MENU) {
        const resolved = resolvePromotions(price, PROMOTIONS, item, now, TZ);
        const priced = priceFor(price, PROMOTIONS, item, now, TZ);
        const active = activePromotionsFor(PROMOTIONS, item, now, TZ);
        if (resolved.priced.price !== priced.price) violations.push(`resolve price drift for ${item.slug}`);
        if (resolved.active.length !== active.length) violations.push(`resolve active drift for ${item.slug}`);
        const kinds = resolved.badges.map((b) => (b.kind === 'custom' ? `custom:${b.label.en}` : b.kind));
        if (new Set(kinds).size !== kinds.length) violations.push(`duplicate badge kinds for ${item.slug}: ${kinds.join(',')}`);
      }
    }
    expect(violations.slice(0, 20)).toEqual([]);
    // Deliberately generous: this is a brute-force sweep (hundreds of thousands of
    // schedule evaluations), so it must not turn flaky on a loaded machine.
  }, 30_000);
});

describe('applyDiscount value edges', () => {
  const base = (over: Partial<Promotion>): Promotion => ({
    id: 'x', name: 'x', type: 'percentage', value: 0, scope: 'all', ...over,
  });

  it('clamps percentage above 100 to a free item, and ignores negatives', () => {
    expect(applyDiscount(100, base({ type: 'percentage', value: 100 }))).toBe(0);
    expect(applyDiscount(100, base({ type: 'percentage', value: 150 }))).toBe(0);
    expect(applyDiscount(100, base({ type: 'percentage', value: -10 }))).toBe(100);
    expect(applyDiscount(100, base({ type: 'percentage', value: 0 }))).toBe(100);
  });

  it('never drives a fixed discount below zero, and ignores negative amounts', () => {
    expect(applyDiscount(50, base({ type: 'fixed', value: 1000 }))).toBe(0);
    expect(applyDiscount(50, base({ type: 'fixed', value: 50 }))).toBe(0);
    expect(applyDiscount(50, base({ type: 'fixed', value: -5 }))).toBe(50);
  });

  it('leaves non-positive prices untouched', () => {
    expect(applyDiscount(0, base({ type: 'percentage', value: 50 }))).toBe(0);
  });

  it('rounds to 2 decimals', () => {
    expect(applyDiscount(9.99, base({ type: 'percentage', value: 33 }))).toBe(6.69);
  });

  it('does not emit NaN for a malformed (NaN) promotion value', () => {
    expect(Number.isFinite(applyDiscount(100, base({ type: 'percentage', value: NaN })))).toBe(true);
    expect(Number.isFinite(applyDiscount(100, base({ type: 'fixed', value: NaN })))).toBe(true);
  });
});

describe('midnight-spanning happy hour lands on exactly the right hours', () => {
  const fri22to02: Promotion = {
    id: 'hh', name: 'Friday Happy Hour', type: 'percentage', value: 50, scope: 'all',
    schedule: { windows: [{ kind: 'recurring', days: [5 as Weekday], start: '22:00', end: '02:00' }] },
  };

  /** Build a Date that is the given local wall-clock time in TZ (July, no DST ambiguity). */
  const localJuly = (day: number, hour: number): Date => new Date(Date.UTC(2026, 6, day, hour - 3, 0, 0)); // Israel = UTC+3 in July

  it('is live Friday 22:00-23:59 and Saturday 00:00-01:59, and dead otherwise', () => {
    // 2026-07-17 is a Friday, 2026-07-18 is a Saturday
    expect(isPromotionActive(fri22to02, localJuly(17, 21), TZ)).toBe(false);
    expect(isPromotionActive(fri22to02, localJuly(17, 22), TZ)).toBe(true);
    expect(isPromotionActive(fri22to02, localJuly(17, 23), TZ)).toBe(true);
    expect(isPromotionActive(fri22to02, localJuly(18, 0), TZ)).toBe(true);
    expect(isPromotionActive(fri22to02, localJuly(18, 1), TZ)).toBe(true);
    expect(isPromotionActive(fri22to02, localJuly(18, 2), TZ)).toBe(false);
    expect(isPromotionActive(fri22to02, localJuly(18, 12), TZ)).toBe(false);
    // Thursday night must NOT be live (only Friday's window bleeds into Saturday)
    expect(isPromotionActive(fri22to02, localJuly(16, 23), TZ)).toBe(false);
    expect(isPromotionActive(fri22to02, localJuly(17, 1), TZ)).toBe(false);
  });
});

describe('scope targeting', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  const mk = (over: Partial<Promotion>): Promotion => ({ id: 's', name: 's', type: 'percentage', value: 10, scope: 'all', ...over });

  it('item scope requires an explicit slug match', () => {
    expect(promotionAppliesTo(mk({ scope: 'item', targetSlugs: ['a'] }), { slug: 'a' })).toBe(true);
    expect(promotionAppliesTo(mk({ scope: 'item', targetSlugs: ['a'] }), { slug: 'b' })).toBe(false);
    expect(promotionAppliesTo(mk({ scope: 'item', targetSlugs: [] }), { slug: 'a' })).toBe(false);
    expect(promotionAppliesTo(mk({ scope: 'item' }), { slug: 'a' })).toBe(false);
  });

  it('category scope requires the item to carry that category', () => {
    expect(promotionAppliesTo(mk({ scope: 'category', targetCategories: ['c'] }), { slug: 'a', category: 'c' })).toBe(true);
    expect(promotionAppliesTo(mk({ scope: 'category', targetCategories: ['c'] }), { slug: 'a', category: 'd' })).toBe(false);
    expect(promotionAppliesTo(mk({ scope: 'category', targetCategories: ['c'] }), { slug: 'a' })).toBe(false);
    expect(promotionAppliesTo(mk({ scope: 'category' }), { slug: 'a', category: 'c' })).toBe(false);
  });

  it('all scope always applies', () => {
    expect(promotionAppliesTo(mk({ scope: 'all' }), { slug: 'anything' })).toBe(true);
  });

  it('badges dedupe by kind but keep distinct custom labels', () => {
    const badges = promotionBadges([
      mk({ id: '1', badgeKind: 'happy_hour' }),
      mk({ id: '2', badgeKind: 'happy_hour' }),
      mk({ id: '3', badgeKind: 'custom', badgeLabel: { en: 'A', he: 'א' } }),
      mk({ id: '4', badgeKind: 'custom', badgeLabel: { en: 'B', he: 'ב' } }),
      mk({ id: '5', badgeKind: 'custom', badgeLabel: { en: 'A', he: 'א' } }),
    ]);
    expect(badges).toHaveLength(3);
    void now;
  });
});
