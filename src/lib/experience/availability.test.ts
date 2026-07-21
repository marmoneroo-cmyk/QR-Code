import { describe, expect, it } from 'vitest';
import { availableModulesFor } from './availability';
import type { IngredientLabel } from '@/data/cocktail';

const label: IngredientLabel = {
  id: 'l1',
  number: '01',
  name: { en: 'Gin', he: 'ג׳ין' },
  description: { en: '', he: '' },
  layerId: 'glass',
};

describe('availableModulesFor', () => {
  it('offers hero_video only when the item has a feature video', () => {
    // diner-aperol-spritz has a feature video in COCKTAIL_VIDEOS.
    expect(availableModulesFor({ slug: 'diner-aperol-spritz', labels: [label] })).toContain('hero_video');
    expect(availableModulesFor({ slug: 'no-such-video-item', labels: [label] })).not.toContain('hero_video');
  });

  it('offers ingredient_breakdown only when the item has component labels', () => {
    expect(availableModulesFor({ slug: 'x', labels: [label] })).toContain('ingredient_breakdown');
    expect(availableModulesFor({ slug: 'x', labels: [] })).not.toContain('ingredient_breakdown');
  });

  it('always offers taste_profile and related_items', () => {
    const m = availableModulesFor({ slug: 'x', labels: [] });
    expect(m).toContain('taste_profile');
    expect(m).toContain('related_items');
  });

  it('never offers modules the cinematic page does not render', () => {
    const m = availableModulesFor({ slug: 'diner-aperol-spritz', labels: [label] });
    expect(m).not.toContain('story');
    expect(m).not.toContain('perfect_pairings');
    expect(m).not.toContain('mood_tags');
  });
});
