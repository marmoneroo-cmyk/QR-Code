/**
 * Structured logger — the single sanctioned logging sink for the app.
 *
 * Why this exists: once persistence became async (Supabase), failures stopped
 * being immediately visible. A leveled, contextual logger turns silent
 * data-drift into observable events.
 *
 * - Isomorphic: works in both Server Components / route handlers and the browser.
 * - Leveled: debug < info < warn < error, gated by NEXT_PUBLIC_LOG_LEVEL
 *   (defaults: 'debug' in dev, 'info' in production).
 * - Contextual: `logger.child({ scope: 'store' })` attaches persistent fields.
 * - Production output is structured JSON (ready to pipe into a sink later);
 *   development output is human-readable.
 *
 * This is the ONLY file allowed to call `console.*` directly.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
  /** Return a new logger that merges `ctx` into every entry. */
  child(ctx: LogContext): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function activeThreshold(): LogLevel {
  const env = (process.env.NEXT_PUBLIC_LOG_LEVEL ?? '').toLowerCase();
  if (env in LEVEL_ORDER) return env as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/** Normalize an unknown thrown value into a serializable shape. */
export function serializeError(err: unknown): { message: string; name?: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }
  return { message: typeof err === 'string' ? err : JSON.stringify(err) };
}

const isProd = process.env.NODE_ENV === 'production';

/** Map level → console method (the one place console.* is permitted). */
const sink: Record<LogLevel, (...args: unknown[]) => void> = {
  // eslint-disable-next-line no-console
  debug: (...a) => console.debug(...a),
  // eslint-disable-next-line no-console
  info: (...a) => console.info(...a),
  // eslint-disable-next-line no-console
  warn: (...a) => console.warn(...a),
  // eslint-disable-next-line no-console
  error: (...a) => console.error(...a),
};

function emit(level: LogLevel, baseCtx: LogContext, msg: string, ctx?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[activeThreshold()]) return;

  const merged = { ...baseCtx, ...ctx };

  if (isProd) {
    // Structured single-line JSON — parseable by any log aggregator.
    sink[level](
      JSON.stringify({ level, msg, ...merged, ts: new Date().toISOString() })
    );
    return;
  }

  // Dev: readable. Prefix with level + scope, append context object if present.
  const scope = typeof merged.scope === 'string' ? `[${merged.scope}]` : '';
  const hasCtx = Object.keys(merged).length > 0;
  if (hasCtx) {
    sink[level](`${level.toUpperCase()}${scope} ${msg}`, merged);
  } else {
    sink[level](`${level.toUpperCase()}${scope} ${msg}`);
  }
}

function makeLogger(baseCtx: LogContext): Logger {
  return {
    debug: (msg, ctx) => emit('debug', baseCtx, msg, ctx),
    info: (msg, ctx) => emit('info', baseCtx, msg, ctx),
    warn: (msg, ctx) => emit('warn', baseCtx, msg, ctx),
    error: (msg, ctx) => emit('error', baseCtx, msg, ctx),
    child: (ctx) => makeLogger({ ...baseCtx, ...ctx }),
  };
}

export const logger: Logger = makeLogger({});
