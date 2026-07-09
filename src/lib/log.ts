import 'server-only';

/**
 * Minimal structured server logger. One JSON line per event on stdout/stderr —
 * exactly what Vercel/serverless log drains ingest. This is the server-side
 * counterpart of the client store logger; use it instead of bare console calls
 * so every entry carries level/scope/timestamp and is machine-filterable.
 */

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, scope: string, msg: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({ level, scope, msg, ts: new Date().toISOString(), ...meta });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const log = {
  info: (scope: string, msg: string, meta?: Record<string, unknown>): void => emit('info', scope, msg, meta),
  warn: (scope: string, msg: string, meta?: Record<string, unknown>): void => emit('warn', scope, msg, meta),
  error: (scope: string, msg: string, meta?: Record<string, unknown>): void => emit('error', scope, msg, meta),
};
