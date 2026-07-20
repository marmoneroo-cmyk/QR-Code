import { describe, it, expect } from 'vitest';
import {
  checkName,
  checkType,
  checkValue,
  checkScope,
  checkActive,
  checkTargetSlugs,
  checkTargetCategories,
  checkBadgeKind,
  validateInput,
  MAX_NAME_LEN,
  MAX_TARGET_SLUGS,
  MAX_SLUG_LEN,
  MAX_TARGET_CATEGORIES,
  MAX_CATEGORY_LEN,
} from './validate';

describe('checkName', () => {
  it('accepts a non-empty string', () => {
    expect(checkName('Summer Special')).toBeUndefined();
  });

  it('rejects an empty or whitespace-only string', () => {
    expect(checkName('')).toBe('name is required');
    expect(checkName('   ')).toBe('name is required');
  });

  it('rejects non-string values', () => {
    expect(checkName(5)).toBe('name is required');
    expect(checkName(null)).toBe('name is required');
    expect(checkName(undefined)).toBe('name is required');
  });

  it('accepts a name at the max length', () => {
    expect(checkName('x'.repeat(MAX_NAME_LEN))).toBeUndefined();
  });

  it('rejects a name longer than the max length', () => {
    expect(checkName('x'.repeat(MAX_NAME_LEN + 1))).toBe(`name must be at most ${MAX_NAME_LEN} characters`);
  });
});

describe('checkType', () => {
  it('accepts percentage and fixed', () => {
    expect(checkType('percentage')).toBeUndefined();
    expect(checkType('fixed')).toBeUndefined();
  });

  it('rejects any other value', () => {
    expect(checkType('flat')).toBe('type must be percentage|fixed');
    expect(checkType(1)).toBe('type must be percentage|fixed');
    expect(checkType(undefined)).toBe('type must be percentage|fixed');
  });
});

describe('checkValue', () => {
  it('accepts zero and positive numbers', () => {
    expect(checkValue(0)).toBeUndefined();
    expect(checkValue(19.5)).toBeUndefined();
  });

  it('rejects negative numbers', () => {
    expect(checkValue(-1)).toBe('value must be a positive number');
  });

  it('rejects non-number values', () => {
    expect(checkValue('20')).toBe('value must be a positive number');
    expect(checkValue(null)).toBe('value must be a positive number');
  });

  it('rejects NaN and ±Infinity (a NaN discount must never reach the DB)', () => {
    expect(checkValue(NaN)).toBe('value must be a positive number');
    expect(checkValue(Infinity)).toBe('value must be a positive number');
    expect(checkValue(-Infinity)).toBe('value must be a positive number');
  });
});

describe('checkScope', () => {
  it('accepts item, category, all', () => {
    expect(checkScope('item')).toBeUndefined();
    expect(checkScope('category')).toBeUndefined();
    expect(checkScope('all')).toBeUndefined();
  });

  it('rejects any other value', () => {
    expect(checkScope('everything')).toBe('scope must be item|category|all');
    expect(checkScope(undefined)).toBe('scope must be item|category|all');
  });
});

describe('checkActive', () => {
  it('accepts booleans', () => {
    expect(checkActive(true)).toBeUndefined();
    expect(checkActive(false)).toBeUndefined();
  });

  it('rejects non-boolean values', () => {
    expect(checkActive('true')).toBe('active must be a boolean');
    expect(checkActive(1)).toBe('active must be a boolean');
    expect(checkActive(null)).toBe('active must be a boolean');
  });
});

describe('checkTargetSlugs', () => {
  it('accepts an array of strings, including an empty array', () => {
    expect(checkTargetSlugs(['margarita', 'mojito'])).toBeUndefined();
    expect(checkTargetSlugs([])).toBeUndefined();
  });

  it('rejects a non-array value', () => {
    expect(checkTargetSlugs('margarita')).toBe('targetSlugs must be an array of strings');
  });

  it('rejects an array containing a non-string element', () => {
    expect(checkTargetSlugs(['margarita', 5])).toBe('targetSlugs must be an array of strings');
  });

  it('accepts an array at the max size', () => {
    expect(checkTargetSlugs(Array.from({ length: MAX_TARGET_SLUGS }, () => 'slug'))).toBeUndefined();
  });

  it('rejects an array larger than the max size', () => {
    expect(checkTargetSlugs(Array.from({ length: MAX_TARGET_SLUGS + 1 }, () => 'slug'))).toBe(
      `targetSlugs must have at most ${MAX_TARGET_SLUGS} entries`,
    );
  });

  it('accepts a slug at the max length', () => {
    expect(checkTargetSlugs(['x'.repeat(MAX_SLUG_LEN)])).toBeUndefined();
  });

  it('rejects a slug longer than the max length', () => {
    expect(checkTargetSlugs(['x'.repeat(MAX_SLUG_LEN + 1)])).toBe(
      `each targetSlug must be at most ${MAX_SLUG_LEN} characters`,
    );
  });
});

describe('checkBadgeKind', () => {
  it('accepts a known badge kind', () => {
    expect(checkBadgeKind('signature')).toBeUndefined();
    expect(checkBadgeKind('custom')).toBeUndefined();
  });

  it('rejects an unknown badge kind', () => {
    expect(checkBadgeKind('legendary')).toBe('badgeKind is invalid');
  });
});

describe('validateInput', () => {
  it('accepts a minimal fully-valid input and returns a PromotionInput', () => {
    const result = validateInput({ name: 'Happy Hour', type: 'percentage', value: 20, scope: 'all' });
    expect(result).toEqual({
      name: 'Happy Hour',
      type: 'percentage',
      value: 20,
      scope: 'all',
      targetSlugs: undefined,
      targetCategories: undefined,
      schedule: undefined,
      badgeKind: undefined,
      badgeLabel: undefined,
      active: undefined,
    });
  });

  it('accepts a fully-populated input with all optional fields', () => {
    const result = validateInput({
      name: '  Summer Special  ',
      type: 'fixed',
      value: 10,
      scope: 'item',
      active: true,
      targetSlugs: ['margarita'],
      targetCategories: ['cocktails'],
      schedule: { windows: [] },
      badgeKind: 'seasonal',
      badgeLabel: { en: 'Summer', he: 'קיץ' },
    });
    expect(typeof result).not.toBe('string');
    expect(result).toMatchObject({
      name: 'Summer Special',
      type: 'fixed',
      value: 10,
      scope: 'item',
      active: true,
      targetSlugs: ['margarita'],
      targetCategories: ['cocktails'],
      badgeKind: 'seasonal',
      badgeLabel: { en: 'Summer', he: 'קיץ' },
    });
  });

  it('trims the name in the returned input', () => {
    const result = validateInput({ name: '  Padded  ', type: 'percentage', value: 5, scope: 'all' });
    expect((result as { name: string }).name).toBe('Padded');
  });

  it('rejects an empty object on the first required field (name)', () => {
    expect(validateInput({})).toBe('name is required');
  });

  it('rejects a missing name', () => {
    expect(validateInput({ type: 'percentage', value: 20, scope: 'all' })).toBe('name is required');
  });

  it('rejects an invalid type', () => {
    expect(validateInput({ name: 'x', type: 'flat', value: 20, scope: 'all' })).toBe(
      'type must be percentage|fixed',
    );
  });

  it('rejects an invalid value', () => {
    expect(validateInput({ name: 'x', type: 'percentage', value: -5, scope: 'all' })).toBe(
      'value must be a positive number',
    );
  });

  it('rejects an invalid scope', () => {
    expect(validateInput({ name: 'x', type: 'percentage', value: 20, scope: 'everywhere' })).toBe(
      'scope must be item|category|all',
    );
  });

  it('rejects an invalid active when provided', () => {
    expect(
      validateInput({ name: 'x', type: 'percentage', value: 20, scope: 'all', active: 'yes' }),
    ).toBe('active must be a boolean');
  });

  it('rejects invalid targetSlugs when provided', () => {
    expect(
      validateInput({ name: 'x', type: 'percentage', value: 20, scope: 'all', targetSlugs: 'margarita' }),
    ).toBe('targetSlugs must be an array of strings');
  });

  it('rejects an invalid badgeKind when provided', () => {
    expect(
      validateInput({ name: 'x', type: 'percentage', value: 20, scope: 'all', badgeKind: 'legendary' }),
    ).toBe('badgeKind is invalid');
  });

  it('ignores unknown extra keys instead of rejecting (not a whitelist)', () => {
    const result = validateInput({
      name: 'x',
      type: 'percentage',
      value: 20,
      scope: 'all',
      unknownField: 'should be dropped',
    });
    expect(typeof result).not.toBe('string');
    expect(result).not.toHaveProperty('unknownField');
  });

  // targetCategories is persisted and re-served to anonymous diners exactly like
  // targetSlugs, so it must be bounded and type-checked the same way.
  it('rejects targetCategories that is not an array of strings', () => {
    expect(
      validateInput({ name: 'x', type: 'percentage', value: 20, scope: 'category', targetCategories: 'cocktails' }),
    ).toBe('targetCategories must be an array of strings');
    expect(
      validateInput({ name: 'x', type: 'percentage', value: 20, scope: 'category', targetCategories: ['ok', 5] }),
    ).toBe('targetCategories must be an array of strings');
    expect(
      validateInput({ name: 'x', type: 'percentage', value: 20, scope: 'category', targetCategories: [{}, null] }),
    ).toBe('targetCategories must be an array of strings');
  });

  it('rejects an oversized targetCategories payload', () => {
    expect(
      validateInput({
        name: 'x',
        type: 'percentage',
        value: 20,
        scope: 'category',
        targetCategories: Array.from({ length: MAX_TARGET_CATEGORIES + 1 }, () => 'c'),
      }),
    ).toBe(`targetCategories must have at most ${MAX_TARGET_CATEGORIES} entries`);
  });

  it('rejects an over-long single category', () => {
    expect(
      validateInput({
        name: 'x',
        type: 'percentage',
        value: 20,
        scope: 'category',
        targetCategories: ['x'.repeat(MAX_CATEGORY_LEN + 1)],
      }),
    ).toBe(`each targetCategory must be at most ${MAX_CATEGORY_LEN} characters`);
  });

  it('accepts a well-formed targetCategories', () => {
    const result = validateInput({
      name: 'x',
      type: 'percentage',
      value: 20,
      scope: 'category',
      targetCategories: ['cocktails', 'mains'],
    });
    expect(typeof result).not.toBe('string');
  });
});

describe('checkSchedule', () => {
  const base = { name: 'x', type: 'percentage', value: 20, scope: 'all' };

  it('rejects a schedule that cannot be evaluated', () => {
    // `{}` reaches isScheduleActive as windows === undefined — historically a TypeError
    // on every menu render.
    expect(validateInput({ ...base, schedule: {} })).toBe('schedule must have a bounded windows array');
    expect(validateInput({ ...base, schedule: { windows: null } })).toBe('schedule must have a bounded windows array');
    expect(validateInput({ ...base, schedule: { windows: 'nope' } })).toBe('schedule must have a bounded windows array');
    expect(validateInput({ ...base, schedule: [] })).toBe('schedule must have a bounded windows array');
  });

  it('rejects an unbounded windows array', () => {
    expect(
      validateInput({
        ...base,
        schedule: { windows: Array.from({ length: 500 }, () => ({ kind: 'recurring', days: [], start: '00:00', end: '24:00' })) },
      }),
    ).toBe('schedule must have a bounded windows array');
  });

  it('accepts an absent schedule and a well-formed one', () => {
    expect(typeof validateInput({ ...base })).not.toBe('string');
    expect(typeof validateInput({ ...base, schedule: { windows: [] } })).not.toBe('string');
    expect(
      typeof validateInput({
        ...base,
        schedule: { windows: [{ kind: 'recurring', days: [5], start: '22:00', end: '02:00' }] },
      }),
    ).not.toBe('string');
  });
});

describe('checkTargetCategories', () => {
  it('accepts arrays of strings, including empty', () => {
    expect(checkTargetCategories([])).toBeUndefined();
    expect(checkTargetCategories(['cocktails'])).toBeUndefined();
  });

  it('rejects non-arrays and non-string entries', () => {
    expect(checkTargetCategories('cocktails')).toBe('targetCategories must be an array of strings');
    expect(checkTargetCategories(['cocktails', 5])).toBe('targetCategories must be an array of strings');
  });

  it('enforces the entry-count cap', () => {
    expect(checkTargetCategories(Array.from({ length: MAX_TARGET_CATEGORIES }, () => 'c'))).toBeUndefined();
    expect(checkTargetCategories(Array.from({ length: MAX_TARGET_CATEGORIES + 1 }, () => 'c'))).toBe(
      `targetCategories must have at most ${MAX_TARGET_CATEGORIES} entries`,
    );
  });

  it('enforces the per-entry length cap', () => {
    expect(checkTargetCategories(['x'.repeat(MAX_CATEGORY_LEN)])).toBeUndefined();
    expect(checkTargetCategories(['x'.repeat(MAX_CATEGORY_LEN + 1)])).toBe(
      `each targetCategory must be at most ${MAX_CATEGORY_LEN} characters`,
    );
  });
});
