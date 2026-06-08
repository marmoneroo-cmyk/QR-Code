/**
 * Observability primitives: a STABLE event taxonomy and correlation context.
 *
 * Why a taxonomy instead of free-text logs:
 *   logger.info("saved")              ← un-queryable noise as the system grows
 *   logger.info("draft.save.succeeded") ← a stable event you can alert/graph on
 *
 * Why correlation IDs:
 *   one logical operation (save) fans out into upsert → retry → child inserts.
 *   A shared requestId stitches those scattered async log lines back together.
 */

/** Stable, dotted event names. Never rename — only add. */
export const StoreEvents = {
  init: 'store.init',
  save: {
    started: 'draft.save.started',
    retry: 'draft.save.retry',
    succeeded: 'draft.save.succeeded',
    failed: 'draft.save.failed',
  },
  load: {
    started: 'draft.load.started',
    succeeded: 'draft.load.succeeded',
    failed: 'draft.load.failed',
  },
  remove: {
    started: 'draft.delete.started',
    succeeded: 'draft.delete.succeeded',
    failed: 'draft.delete.failed',
  },
  publish: {
    started: 'draft.publish.started',
    succeeded: 'draft.publish.succeeded',
    failed: 'draft.publish.failed',
  },
  find: {
    started: 'draft.find.started',
    succeeded: 'draft.find.succeeded',
    failed: 'draft.find.failed',
  },
} as const;

/** Correlation context threaded through one operation chain. */
export interface OpContext {
  /** Unique per logical operation; ties scattered async logs together. */
  requestId: string;
  /** Operation family, e.g. 'draft.save'. */
  op: string;
  /** Tenant root. */
  restaurantId?: string;
  /** Draft slug under operation. */
  slug?: string;
  /** Active backend ('localStorage' | 'supabase'). */
  provider?: string;
}

/** Generate a correlation id. crypto.randomUUID where available, else a fallback. */
export function newRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  // Non-cryptographic fallback — adequate for log correlation.
  return `req_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
