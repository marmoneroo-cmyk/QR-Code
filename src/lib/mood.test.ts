import { describe, it, expect } from 'vitest';
import { moodTags, matchesMood } from './mood';
import type { FlavorProfile } from '@/data/cocktail';

const f = (over: Partial<FlavorProfile> = {}): FlavorProfile => ({
  sweet: 0,
  bitter: 0,
  citrus: 0,
  smoky: 0,
  herbal: 0,
  ...over,
});

describe('moodTags', () => {
  it('tags a citrus-forward drink as sour + refreshing', () => {
    expect(moodTags(f({ citrus: 5 }))).toEqual(expect.arrayContaining(['sour', 'refreshing']));
  });

  it('does NOT call a smoky citrus drink refreshing', () => {
    const tags = moodTags(f({ citrus: 4, smoky: 4 }));
    expect(tags).toContain('sour');
    expect(tags).toContain('strong');
    expect(tags).not.toContain('refreshing');
  });

  it('tags sweet and herbal independently', () => {
    expect(moodTags(f({ sweet: 4 }))).toEqual(['sweet']);
    expect(moodTags(f({ herbal: 3 }))).toEqual(['herbal']);
  });

  it('tags a bitter Negroni-like drink as strong', () => {
    expect(moodTags(f({ bitter: 4, herbal: 1 }))).toEqual(['strong']);
  });

  it('returns no tags for a flat profile', () => {
    expect(moodTags(f({ sweet: 1, citrus: 2 }))).toEqual([]);
  });
});

describe('matchesMood', () => {
  it('matches when the tag is present', () => {
    expect(matchesMood(f({ sweet: 5 }), 'sweet')).toBe(true);
    expect(matchesMood(f({ sweet: 5 }), 'strong')).toBe(false);
  });
});
