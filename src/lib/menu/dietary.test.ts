import { describe, expect, it } from 'vitest';
import { extractDietaryBadges } from './dietary';

describe('extractDietaryBadges', () => {
  it('strips a trailing gluten-free badge and records the flag', () => {
    const { name, flags } = extractDietaryBadges('אנטריקוט (פריים ריב) מנה ללא גלוטן');

    expect(name).toBe('אנטריקוט (פריים ריב)');
    expect(flags).toEqual({ glutenFree: true });
  });

  it('strips two stacked badges from one name', () => {
    const { name, flags } = extractDietaryBadges('סלט המאירי מנה צמחונית מנה ללא גלוטן');

    expect(name).toBe('סלט המאירי');
    expect(flags).toEqual({ glutenFree: true });
  });

  it('keeps vegetarian and vegan burgers distinguishable', () => {
    // The whole reason only full badge phrases are stripped: these are two
    // different dishes, and a bare-adjective strip would make both "המבורגר".
    expect(extractDietaryBadges('המבורגר צמחוני').name).toBe('המבורגר צמחוני');
    expect(extractDietaryBadges('המבורגר טבעוני').name).toBe('המבורגר טבעוני');
  });

  it('does not promote a vegetarian badge to vegan', () => {
    const { flags } = extractDietaryBadges("צ'יפס מנה צמחונית");

    expect(flags.vegan).toBeUndefined();
  });

  it('records vegan only from an explicit vegan badge', () => {
    expect(extractDietaryBadges('קארי מנה טבעונית').flags).toEqual({ vegan: true });
  });

  it('leaves an unbadged name and its flags untouched', () => {
    const { name, flags } = extractDietaryBadges('נקניקיית מרגז');

    expect(name).toBe('נקניקיית מרגז');
    expect(flags).toEqual({});
  });

  it('keeps the original name when it is nothing but a badge', () => {
    expect(extractDietaryBadges('מנה צמחונית').name).toBe('מנה צמחונית');
  });

  it('handles the English badge wording', () => {
    const { name, flags } = extractDietaryBadges('Caesar Salad vegan dish');

    expect(name).toBe('Caesar Salad');
    expect(flags).toEqual({ vegan: true });
  });
});
