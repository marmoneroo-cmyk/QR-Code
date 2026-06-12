/**
 * Business segmentation — stamped on EVERY event so that, the day we start
 * learning real thresholds, we can normalise by what KIND of business and dish
 * each data point came from. A 0.12 intent rate is great for a cocktail and poor
 * for a dessert; a cocktail bar and a burger joint have different healthy funnels.
 *
 * This is pure metadata captured from day one — NOT used by the AI yet. Backfilling
 * it later is impossible, so we collect it now. (See ordering-intent-spec.md.)
 */

export type RestaurantType =
  | 'cocktail_bar'
  | 'restaurant'
  | 'burger_restaurant'
  | 'wine_bar'
  | 'cafe'
  | 'fast_casual'
  | 'fine_dining';

export const RESTAURANT_TYPES: readonly RestaurantType[] = [
  'cocktail_bar', 'restaurant', 'burger_restaurant', 'wine_bar', 'cafe', 'fast_casual', 'fine_dining',
];

export type MenuCategory =
  | 'cocktail'
  | 'beer'
  | 'wine'
  | 'starter'
  | 'main'
  | 'burger'
  | 'dessert'
  | 'side'
  | 'other';

export const MENU_CATEGORIES: readonly MenuCategory[] = [
  'cocktail', 'beer', 'wine', 'starter', 'main', 'burger', 'dessert', 'side', 'other',
];

/**
 * Per-tenant restaurant type. A code map for now (single 'diner' tenant); moves to
 * `restaurants.restaurant_type` (migration prepared) when multi-tenant onboarding lands.
 */
const RESTAURANT_TYPE_BY_SLUG: Readonly<Record<string, RestaurantType>> = {
  diner: 'restaurant',
};

export function restaurantTypeFor(slug: string): RestaurantType {
  return RESTAURANT_TYPE_BY_SLUG[slug] ?? 'restaurant';
}
