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
