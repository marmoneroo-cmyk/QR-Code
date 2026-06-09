import { describe, it, expect } from 'vitest';
import { buildBriefing } from './briefing';
import type { OpportunityType } from '../opportunities/types';

const DRINK = { en: 'Aperol Spritz', he: 'אפרול שפריץ' };

const ALL_TYPES: OpportunityType[] = [
  'promote_position',
  'fix_offer',
  'promote_marketing',
  'promotion_candidate',
  'reengage_returning',
];

describe('buildBriefing', () => {
  it('returns a bilingual narrative for every opportunity type', () => {
    for (const type of ALL_TYPES) {
      const b = buildBriefing(type, DRINK);
      expect(b.en.length).toBeGreaterThan(20);
      expect(b.he.length).toBeGreaterThan(20);
    }
  });

  it('weaves the drink name into the story (not a metric dump)', () => {
    const b = buildBriefing('promote_position', DRINK);
    expect(b.en).toContain('Aperol Spritz');
    expect(b.he).toContain('אפרול שפריץ');
  });

  it('reads as a story about guests, never invents figures', () => {
    for (const type of ALL_TYPES) {
      const b = buildBriefing(type, DRINK);
      // story-first: speaks about guests / the room, not raw counters
      expect(b.en.toLowerCase()).toMatch(/guest|regular/);
      // honesty: no fabricated hard numbers in the narrative copy
      expect(b.en).not.toMatch(/\d{2,}/);
      expect(b.he).not.toMatch(/\d{2,}/);
    }
  });

  it('frames visibility opportunities as "interest is real, visibility is not"', () => {
    const b = buildBriefing('promote_position', DRINK);
    expect(b.en.toLowerCase()).toContain('visibility');
  });
});
