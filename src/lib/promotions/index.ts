export type { DiscountType, PromotionScope, Promotion, PromotableItem, PricedResult } from './types';
export {
  isPromotionActive,
  promotionAppliesTo,
  activePromotionsFor,
  applyDiscount,
  priceFor,
  promotionBadges,
  resolvePromotions,
} from './promotions';
