import { describe, it, expect } from 'vitest';
import { splitFocusActions, isStatusActive, type OppStatusMap } from './focus';

const NOW = 1_000_000;

/** Minimal ranked items — only `id` matters to the split. */
const ACTIONS = [
  { id: 'a' },
  { id: 'b' },
  { id: 'c' },
  { id: 'd' },
  { id: 'e' },
];

describe('isStatusActive', () => {
  it('treats done and dismissed as always active', () => {
    expect(isStatusActive({ status: 'done' }, NOW)).toBe(true);
    expect(isStatusActive({ status: 'dismissed' }, NOW)).toBe(true);
  });

  it('treats a snooze as active only until its time passes', () => {
    expect(isStatusActive({ status: 'snoozed', until: NOW + 100 }, NOW)).toBe(true);
    expect(isStatusActive({ status: 'snoozed', until: NOW - 100 }, NOW)).toBe(false);
    expect(isStatusActive({ status: 'snoozed' }, NOW)).toBe(false);
  });
});

describe('splitFocusActions', () => {
  it('surfaces only the top N open actions', () => {
    const { focusOpen, focusDone } = splitFocusActions(ACTIONS, {}, NOW, 3);
    expect(focusOpen.map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(focusDone).toEqual([]);
  });

  it('promotes the next-ranked action into focus when one is completed', () => {
    const statuses: OppStatusMap = { a: { status: 'done' } };
    const { focusOpen, focusDone } = splitFocusActions(ACTIONS, statuses, NOW, 3);
    // 'a' done -> focus shifts to the next three open ones
    expect(focusOpen.map((a) => a.id)).toEqual(['b', 'c', 'd']);
    expect(focusDone.map((a) => a.id)).toEqual(['a']);
  });

  it('keeps EVERY done action visible — even one ranked outside the focus window', () => {
    // 'e' is rank 5 (outside any top-3 slice) but completed. The old slice-first logic
    // dropped it entirely; it must still appear in focusDone so it can be undone.
    const statuses: OppStatusMap = { e: { status: 'done' } };
    const { focusOpen, focusDone } = splitFocusActions(ACTIONS, statuses, NOW, 3);
    expect(focusOpen.map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(focusDone.map((a) => a.id)).toEqual(['e']);
  });

  it('reports all remaining as done when nothing is open', () => {
    const statuses: OppStatusMap = Object.fromEntries(
      ACTIONS.map((a) => [a.id, { status: 'done' as const }]),
    );
    const { focusOpen, focusDone } = splitFocusActions(ACTIONS, statuses, NOW, 3);
    expect(focusOpen).toEqual([]);
    expect(focusDone).toHaveLength(5);
  });

  it('ignores an expired snooze (treats it as open again)', () => {
    const statuses: OppStatusMap = { a: { status: 'snoozed', until: NOW - 1 } };
    const { focusOpen } = splitFocusActions(ACTIONS, statuses, NOW, 3);
    expect(focusOpen.map((a) => a.id)).toContain('a');
  });
});
