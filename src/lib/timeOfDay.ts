import { localParts } from './scheduling/schedule';
import type { Lang } from '@/data/cocktail';

/** A contextual menu hint based on the restaurant-local hour. Simple rules, no AI. */
export function timeOfDayHint(now: Date, tz: string, lang: Lang): string | null {
  const hour = Math.floor(localParts(now, tz).minutes / 60);
  const isHebrew = lang === 'he';
  if (hour >= 17 && hour < 21) return isHebrew ? 'מושלם לשקיעה' : 'Perfect for sunset';
  if (hour >= 21 || hour < 3) return isHebrew ? 'שעת לילה' : 'Nightcap hour';
  if (hour >= 12 && hour < 17) return isHebrew ? 'מרענן של אחר הצהריים' : 'Afternoon refresher';
  return isHebrew ? 'בוקר של בועות' : 'Morning bubbles';
}
