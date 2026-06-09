/**
 * The Action Center focus split — pure, testable logic kept out of the component.
 *
 * The whole point of the Action Center is "3 things to do today": always surface the
 * top OPEN actions so finishing one PROMOTES the next into focus, while tracking EVERY
 * completed action separately so a done item never vanishes on a re-rank and can always
 * be undone. (A previous version sliced the top-N first and split within it, so done
 * items dropped out of view when the live ranking shifted — and undo couldn't reach them.)
 */

/** Persisted status kinds — shared with the Opportunity board via localStorage. */
export type OppStatusKind = 'done' | 'dismissed' | 'snoozed';

export interface OppStatusEntry {
  status: OppStatusKind;
  /** Epoch ms; only meaningful for `snoozed` (kept so we don't clobber the board). */
  until?: number;
}

export type OppStatusMap = Record<string, OppStatusEntry>;

/** A snooze counts as "active" only while its `until` is still in the future. */
export function isStatusActive(entry: OppStatusEntry, now: number): boolean {
  if (entry.status === 'snoozed') return typeof entry.until === 'number' && entry.until > now;
  return true;
}

export interface FocusSplit<T> {
  /** The top `focusCount` OPEN actions — finishing one promotes the next in. */
  focusOpen: T[];
  /** EVERY action with an active status, in ranked order — never a fragile slice. */
  focusDone: T[];
}

/**
 * Split a ranked action list into the open focus (top `focusCount`) and everything
 * already handled. Done items are collected across the WHOLE list (not a pre-sliced
 * window), so they stay visible and undo-able regardless of how the ranking shifts.
 */
export function splitFocusActions<T extends { id: string }>(
  actions: readonly T[],
  statuses: OppStatusMap,
  now: number,
  focusCount: number,
): FocusSplit<T> {
  const open: T[] = [];
  const done: T[] = [];
  for (const a of actions) {
    const entry = statuses[a.id];
    if (entry && isStatusActive(entry, now)) done.push(a);
    else open.push(a);
  }
  return { focusOpen: open.slice(0, focusCount), focusDone: done };
}
