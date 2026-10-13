// Reads a request body into memory, but stops as soon as it grows past a limit.
// Why: Content-Length can be missing (chunked uploads) or wrong, so it cannot be the only guard —
// only counting the bytes really read enforces a cap. Pure over a ReadableStream, so it is
// tested without a server.

// Returns the whole body, or null when it is larger than maxBytes (the rest is never read).
// An absent body is an empty body. A broken stream throws — the caller decides what that means.
export async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (body === null) return new Uint8Array(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > maxBytes) {
        // Over the cap: tell the sender to stop, and keep nothing
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // One buffer, in the order the chunks arrived
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
