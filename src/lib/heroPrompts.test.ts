import { describe, it, expect } from 'vitest';
import { slugify } from './heroPrompts';

/**
 * slugify is the sink guard for user-controlled filenames (the generate-breakdown route
 * interpolates it into a server path). These assertions lock in the path-traversal safety
 * on top of the basic slug behavior.
 */
describe('slugify — path-traversal safety', () => {
  it('strips every path separator and dot so a slug can never escape a directory', () => {
    const s = slugify('../../etc/passwd');
    expect(s).not.toMatch(/[./\\]/); // no dots or slashes survive
    expect(s).toBe('etcpasswd');
  });

  it('neutralizes a pure traversal string to the safe fallback', () => {
    expect(slugify('../../')).toBe('untitled');
    expect(slugify('..\\..\\')).toBe('untitled');
  });
});

describe('slugify — basic behavior', () => {
  it('keeps only [a-z0-9-], lowercased, spaces → hyphens', () => {
    expect(slugify('Smoked Old Fashioned!')).toBe('smoked-old-fashioned');
  });

  it('collapses repeated spaces/hyphens and caps length at 60', () => {
    expect(slugify('a   b---c')).toBe('a-b-c');
    expect(slugify('x'.repeat(100))).toHaveLength(60);
  });

  it('falls back to "untitled" on empty or symbol-only input', () => {
    expect(slugify('')).toBe('untitled');
    expect(slugify('!!!')).toBe('untitled');
  });
});
