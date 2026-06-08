import type { FlavorProfile } from '@/data/cocktail';

/** Diner-facing "what suits me now?" moods, derived from the flavor profile. */
export type Mood = 'sweet' | 'sour' | 'refreshing' | 'strong' | 'herbal';

export const MOODS: readonly Mood[] = ['sweet', 'sour', 'refreshing', 'strong', 'herbal'];

export const MOOD_LABEL: Record<Mood, { en: string; he: string }> = {
  sweet: { en: 'Sweet', he: 'מתוק' },
  sour: { en: 'Sour', he: 'חמוץ' },
  refreshing: { en: 'Refreshing', he: 'מרענן' },
  strong: { en: 'Strong', he: 'חזק' },
  herbal: { en: 'Herbal', he: 'צמחי' },
};

/** Flavor axes are 0–5. Thresholds chosen so each cocktail earns 1–3 moods. */
export function moodTags(f: FlavorProfile): Mood[] {
  const tags: Mood[] = [];
  if (f.sweet >= 3) tags.push('sweet');
  if (f.citrus >= 3) tags.push('sour');
  if (f.citrus >= 3 && f.smoky === 0) tags.push('refreshing');
  if (f.bitter >= 3 || f.smoky >= 3) tags.push('strong');
  if (f.herbal >= 3) tags.push('herbal');
  return tags;
}

export function matchesMood(f: FlavorProfile, mood: Mood): boolean {
  return moodTags(f).includes(mood);
}
