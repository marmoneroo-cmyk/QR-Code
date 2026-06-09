import type { BadgeKind, BadgeLabel, BadgeTone } from './types';

/** Default bilingual label per badge kind (custom must supply its own). */
export const BADGE_LABELS: Record<BadgeKind, BadgeLabel> = {
  signature: { en: "⭐ Bartender's Pick", he: '⭐ מומלץ על ידי הברמן' },
  guest_favorite: { en: '❤ Guest Favorite', he: '❤ אהוב על האורחים' },
  trending: { en: '🔥 Most Popular', he: '🔥 הכי פופולרי' },
  happy_hour: { en: 'Happy Hour', he: 'שעה שמחה' },
  discount: { en: 'Special Price', he: 'מחיר מיוחד' },
  seasonal: { en: 'Seasonal', he: 'עונתי' },
  limited_time: { en: 'Limited Time', he: 'לזמן מוגבל' },
  new_item: { en: 'New', he: 'חדש' },
  custom: { en: '', he: '' },
};

/** Default styling tone per badge kind. */
export const BADGE_TONES: Record<BadgeKind, BadgeTone> = {
  signature: 'gold',
  guest_favorite: 'gold',
  trending: 'hot',
  happy_hour: 'hot',
  discount: 'hot',
  seasonal: 'cool',
  limited_time: 'accent',
  new_item: 'accent',
  custom: 'accent',
};

/** Resolve the display label for a badge kind, honouring an optional override. */
export function badgeLabel(kind: BadgeKind, override?: BadgeLabel): BadgeLabel {
  if (override && (override.en || override.he)) return override;
  return BADGE_LABELS[kind];
}
