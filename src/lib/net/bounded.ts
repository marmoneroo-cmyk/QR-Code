/**
 * Read a web ReadableStream up to `maxBytes` and return the decoded UTF-8 text, or `null`
 * if the stream exceeds the cap. Pure (no server-only) so it is unit-testable and usable on
 * both request and response bodies.
 *
 * The size of a body CANNOT be trusted from a declared length: a client `Content-Length`
 * header is omitted on chunked requests (so a public endpoint would parse an unbounded
 * body), and a remote server can lie about / stream an oversized response. This enforces
 * the ceiling WHILE reading and aborts the moment it is crossed.
 */
export async function readCappedText(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string | null> {
  if (!stream) return '';
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null; // exceeded the cap — refuse
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* reader already released/cancelled */
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export type CappedJson<T> = { ok: true; data: T } | { ok: false; reason: 'too_large' | 'invalid_json' };

/**
 * Read + JSON-parse a request body with a size ceiling. The standard replacement for a bare
 * `await request.json()` on any route that accepts a body — that never trusts the declared
 * length and refuses an oversized payload before parsing. Callers map the `reason` to their
 * own error response (413 for `too_large`, 400 for `invalid_json`).
 */
export async function readJsonCapped<T>(request: Request, maxBytes: number): Promise<CappedJson<T>> {
  const raw = await readCappedText(request.body, maxBytes);
  if (raw === null) return { ok: false, reason: 'too_large' };
  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}
