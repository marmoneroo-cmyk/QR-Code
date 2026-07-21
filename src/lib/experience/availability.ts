import type { CocktailConfig } from '@/data/cocktail';
import { getFeatureVideo } from '@/data/cocktail';
import type { ExperienceModule } from './types';

/**
 * Which content modules actually EXIST for a given item — so the experience
 * builder only offers toggles that do something, and the guest page only gates
 * what it really renders.
 *
 * The cinematic guest page (CocktailExperience) renders exactly these four:
 *   - hero_video          → only when the item has a feature video
 *   - ingredient_breakdown→ only when the item has component labels
 *   - taste_profile       → always (every item has a flavor profile)
 *   - related_items       → always (co-view "also explored")
 *
 * story / perfect_pairings / mood_tags are NOT part of the cinematic page, so
 * offering toggles for them was the "modules I don't actually have" confusion.
 * When those sections get built, add them here and the builder picks them up.
 */
export function availableModulesFor(
  cocktail: Pick<CocktailConfig, 'slug' | 'labels'>,
): ExperienceModule[] {
  const modules: ExperienceModule[] = [];
  if (getFeatureVideo(cocktail.slug)) modules.push('hero_video');
  if (cocktail.labels.length > 0) modules.push('ingredient_breakdown');
  modules.push('taste_profile');
  modules.push('related_items');
  return modules;
}
