/**
 * Fault injection — deliberate failure testing without unplugging the network.
 *
 * Dev/preview only. NEVER injects in production. Lets us validate the chain:
 *   retry fires · logs emit · UI doesn't hang · draft isn't lost · RLS classified.
 *
 * Configure from the browser console:
 *   __faults.set('network')   → transient error (no code)  → retry SHOULD fire
 *   __faults.set('rls')       → error code 42501           → retry must NOT fire
 *   __faults.set('slow', 2500)→ delay ms                   → tests pending UI
 *   __faults.set('none')      → disabled
 *   __faults.once('network')  → inject once, then auto-clear
 */

import { logger } from '@/lib/logger';

export type FaultKind = 'none' | 'network' | 'rls' | 'slow';

interface FaultConfig {
  kind: FaultKind;
  delayMs: number;
  once: boolean;
}

const STORAGE_KEY = 'cocktail-demo:fault';
const isProd = process.env.NODE_ENV === 'production';
const log = logger.child({ scope: 'faults' });

function read(): FaultConfig {
  if (isProd || typeof window === 'undefined') return { kind: 'none', delayMs: 0, once: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { kind: 'none', delayMs: 0, once: false };
    return JSON.parse(raw) as FaultConfig;
  } catch {
    return { kind: 'none', delayMs: 0, once: false };
  }
}

function write(cfg: FaultConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

/** An RLS/constraint-style error carries a Postgres `code` so isTransient() rejects retry. */
export function makeRlsError(): Error {
  return Object.assign(new Error('Simulated RLS denial (row-level security)'), { code: '42501' });
}

export function makeNetworkError(): Error {
  return new Error('Simulated network failure');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Consulted by the store boundary before each op. May delay or throw.
 * `op` is the event family (e.g. 'draft.save') for logging.
 */
export async function maybeInjectFault(op: string): Promise<void> {
  if (isProd) return;
  const cfg = read();
  if (cfg.kind === 'none') return;

  log.warn('injecting fault', { op, kind: cfg.kind, delayMs: cfg.delayMs });
  if (cfg.once) write({ kind: 'none', delayMs: 0, once: false });

  switch (cfg.kind) {
    case 'slow':
      await sleep(cfg.delayMs || 2000);
      return;
    case 'network':
      await sleep(50);
      throw makeNetworkError();
    case 'rls':
      throw makeRlsError();
  }
}

// Expose a console control surface in dev.
if (!isProd && typeof window !== 'undefined') {
  (window as unknown as { __faults: unknown }).__faults = {
    set: (kind: FaultKind, delayMs = 2000) => write({ kind, delayMs, once: false }),
    once: (kind: FaultKind, delayMs = 2000) => write({ kind, delayMs, once: true }),
    clear: () => write({ kind: 'none', delayMs: 0, once: false }),
    current: () => read(),
  };
}
