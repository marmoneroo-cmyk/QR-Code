import { describe, it, expect } from 'vitest';
import { readCappedText } from './bounded';

function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(enc.encode(p));
      controller.close();
    },
  });
}

describe('readCappedText', () => {
  it('returns the decoded text when under the cap', async () => {
    expect(await readCappedText(streamOf('hello ', 'world'), 100)).toBe('hello world');
  });

  it('returns "" for a null stream', async () => {
    expect(await readCappedText(null, 100)).toBe('');
  });

  it('returns null when the stream exceeds the cap (even across chunks)', async () => {
    // Total 12 bytes across 3 chunks, cap 10 → refused.
    expect(await readCappedText(streamOf('aaaa', 'bbbb', 'cccc'), 10)).toBeNull();
  });

  it('accepts exactly the cap, refuses one byte over', async () => {
    expect(await readCappedText(streamOf('abcde'), 5)).toBe('abcde');
    expect(await readCappedText(streamOf('abcdef'), 5)).toBeNull();
  });

  it('decodes multi-byte UTF-8 correctly', async () => {
    expect(await readCappedText(streamOf('₪ שלום'), 100)).toBe('₪ שלום');
  });
});
