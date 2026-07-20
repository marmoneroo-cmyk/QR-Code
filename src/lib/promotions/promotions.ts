import { isScheduleActive } from '../scheduling/schedule';
import { badgeLabel, BADGE_TONES } from '../experience/badges';
import type { ActiveBadge } from '../experience/types';
import type { Promotion, PromotableItem, PricedResult } from './types';

/**
 * Promotion values arrive from the DB and can be malformed (null/NaN via a bad
 * import or a hand-edited row). A price engine must never emit NaN to a guest, so
 * a non-finite value degrades to 0 — i.e. "no discount" — rather than poisoning
 * the arithmetic.
 */
const safeValue = (v: number): number => (Number.isFinite(v) ? v : 0);
const clampPct = (v: number): number => Math.min(100, Math.max(0, safeValue(v)));
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Is the promotion live right now (restaurant timezone)? */
export function isPromotionActive(p: Promotion, now: Date, tz: string): boolean {
  return isScheduleActive(p.schedule, now, tz);
}

/** Does the promotion target this item? */
export function promotionAppliesTo(p: Promotion, item: PromotableItem): boolean {
  switch (p.scope) {
    case 'all':
      return true;
    case 'item':
      return !!p.targetSlugs?.includes(item.slug);
    case 'category':
      return !!(item.category && p.targetCategories?.includes(item.category));
    default:
      return false;
  }
}

/** All promotions that are both live and targeting this item. */
export function activePromotionsFor(
  promos: Promotion[],
  item: PromotableItem,
  now: Date,
  tz: string,
): Promotion[] {
  return promos.filter((p) => isPromotionActive(p, now, tz) && promotionAppliesTo(p, item));
}

/** Apply a single discount to a price (never below 0). */
export function applyDiscount(price: number, p: Promotion): number {
  if (price <= 0) return price;
  const out =
    p.type === 'percentage'
      ? price * (1 - clampPct(p.value) / 100)
      : price - Math.max(0, safeValue(p.value));
  return Math.max(0, round2(out));
}

/** Best (lowest) price given an ALREADY-resolved active set (no schedule work). */
function bestPriceAmong(price: number, active: Promotion[]): PricedResult {
  let best = price;
  let bestPromo: Promotion | undefined;
  for (const p of active) {
    const discounted = applyDiscount(price, p);
    if (discounted < best) {
      best = discounted;
      bestPromo = p;
    }
  }
  if (!bestPromo) return { price, original: price, discounted: false };
  return { price: best, original: price, discounted: true, promotion: bestPromo };
}

/** Best (lowest) price for an item given all promotions. */
export function priceFor(
  price: number,
  promos: Promotion[],
  item: PromotableItem,
  now: Date,
  tz: string,
): PricedResult {
  return bestPriceAmong(price, activePromotionsFor(promos, item, now, tz));
}

/** Badges derived from active promotions (the Promotions Engine is the source of truth). */
export function promotionBadges(active: Promotion[]): ActiveBadge[] {
  const out: ActiveBadge[] = [];
  const seen = new Set<string>();
  for (const p of active) {
    const kind = p.badgeKind ?? 'happy_hour';
    const key = kind === 'custom' ? `custom:${p.badgeLabel?.en ?? ''}` : kind;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, label: badgeLabel(kind, p.badgeLabel), tone: BADGE_TONES[kind] });
  }
  return out;
}

/** One-shot resolver: final price + promo badges for an item. */
export function resolvePromotions(
  price: number,
  promos: Promotion[],
  item: PromotableItem,
  now: Date,
  tz: string,
): { priced: PricedResult; badges: ActiveBadge[]; active: Promotion[] } {
  // Resolve the active set ONCE and reuse it — going through priceFor here would
  // re-evaluate every promotion's schedule a second time for the same item.
  const active = activePromotionsFor(promos, item, now, tz);
  return { priced: bestPriceAmong(price, active), badges: promotionBadges(active), active };
}
