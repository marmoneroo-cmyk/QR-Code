/**
 * withRetry — run an async operation with exponential backoff.
 *
 * Used for transient failures (network blips, Supabase 5xx) where an
 * immediate retry is likely to succeed. NOT for logical errors (4xx,
 * validation) — those are surfaced immediately via `shouldRetry`.
 */

import { logger, serializeError } from './logger';

export interface RetryOptions {
  /** Max attempts including the first. Default 3. */
  attempts?: number;
  /** Base delay in ms; doubles each attempt. Default 250. */
  baseDelayMs?: number;
  /** Event name / label emitted on each retry (e.g. 'draft.save.retry'). */
  label?: string;
  /** Correlation fields (requestId, slug, …) merged into every retry log. */
  context?: Record<string, unknown>;
  /** Decide whether a thrown error is worth retrying. Default: always. */
  shouldRetry?: (err: unknown) => boolean;
}

const log = logger.child({ scope: 'retry' });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 250;
  const label = opts.label ?? 'op';
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !shouldRetry(err)) break;
      const delay = base * 2 ** (attempt - 1);
      log.warn(label, {
        event: label,
        ...opts.context,
        attempt,
        nextDelayMs: delay,
        error: serializeError(err).message,
      });
      await sleep(delay);
    }
  }
  throw lastErr;
}
