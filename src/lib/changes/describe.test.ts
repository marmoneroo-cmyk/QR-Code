import { describe, expect, it } from 'vitest';
import { describeChange } from './describe';

describe('describeChange', () => {
  it('localizes a promotion_created action in Hebrew', () => {
    const d = describeChange({ changeType: 'promotion_created', summary: 'Happy Hour · −20%' }, true);
    expect(d.label).toBe('מבצע נוסף');
    expect(d.detail).toBe('Happy Hour · −20%');
  });

  it('localizes the same action in English', () => {
    const d = describeChange({ changeType: 'promotion_created', summary: 'Happy Hour · −20%' }, false);
    expect(d.label).toBe('Promotion added');
  });

  it('strips a legacy English wrapper from an old stored summary', () => {
    // Rows written before the log went language-neutral baked the verb in.
    const d = describeChange({ changeType: 'promotion_edited', summary: 'Promotion updated: ui-pause-test' }, true);
    expect(d.label).toBe('מבצע עודכן');
    expect(d.detail).toBe('ui-pause-test');
  });

  it('rewrites a legacy "(−5%)" tail into the neutral format', () => {
    const d = describeChange({ changeType: 'promotion_created', summary: 'Promotion: pause-cycle-test (−5%)' }, true);
    expect(d.detail).toBe('pause-cycle-test · −5%');
  });

  it('shows only the label when a delete has no name', () => {
    const d = describeChange({ changeType: 'promotion_deleted', summary: null }, true);
    expect(d.label).toBe('מבצע הוסר');
    expect(d.detail).toBe('');
  });

  it('leaves a manual entry as the owner wrote it, with no label', () => {
    const d = describeChange({ changeType: 'external', summary: 'החלפתי את תמונת הנגרוני' }, true);
    expect(d.label).toBe('');
    expect(d.detail).toBe('החלפתי את תמונת הנגרוני');
  });

  it('shows an already-localized action title verbatim', () => {
    const d = describeChange({ changeType: 'action_fix_offer', summary: 'שיפרו את התמונה של המרגריטה' }, true);
    expect(d.label).toBe('');
    expect(d.detail).toBe('שיפרו את התמונה של המרגריטה');
  });
});
