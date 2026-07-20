import type { Schedule } from '../scheduling/types';
import type { BadgeKind, BadgeLabel } from '../experience/types';

/** Promotions Engine — scheduled discounts that also drive their own badge state. */

export type DiscountType = 'percentage' | 'fixed';
export type PromotionScope = 'item' | 'category' | 'all';

export interface Promotion {
  id: string;
  name: string; // "Summer Special", "Friday Happy Hour"
  type: DiscountType;
  /** percent 0-100 for `percentage`; ILS amount for `fixed`. */
  value: number;
  scope: PromotionScope;
  /** for scope `item` */
  targetSlugs?: string[];
  /** for scope `category` */
  targetCategories?: string[];
  /**
   * The owner's pause switch. `false` ⇒ paused regardless of schedule;
   * absent ⇒ live (rows written before this column existed).
   */
  active?: boolean;
  /** WHEN the promotion is live. Absent => always live. */
  schedule?: Schedule;
  /** Badge to auto-activate while live (default `happy_hour`). */
  badgeKind?: BadgeKind;
  badgeLabel?: BadgeLabel;
}

export interface PromotableItem {
  slug: string;
  category?: string;
}

export interface PricedResult {
  /** Final price after the best active discount. */
  price: number;
  /** Original (pre-discount) price. */
  original: number;
  discounted: boolean;
  /** The promotion that produced `price`, if any. */
  promotion?: Promotion;
}
