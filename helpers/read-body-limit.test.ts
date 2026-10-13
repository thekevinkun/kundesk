// @vitest-environment node
// Needs Node's own ReadableStream — jsdom's environment may not provide one
import { describe, expect, it, vi } from "vitest";
import { readBodyWithLimit } from "./read-body-limit";

function bytes(length: number, fill = 1): Uint8Array {
  return new Uint8Array(length).fill(fill);
}

// A stream that hands out the given chunks one by one and records what happened to it
function streamOf(chunks: Uint8Array[]) {
  let next = 0;
  const state = { pulled: 0, cancelled: false };

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[next];
      if (chunk === undefined) {
        controller.close();
        return;
      }
      next += 1;
      state.pulled += 1;
      controller.enqueue(chunk);
    },
    cancel() {
      state.cancelled = true;
    },
  });

  return { stream, state };
}

describe("readBodyWithLimit", () => {
  it("treats a missing body as empty", async () => {
    const result = await readBodyWithLimit(null, 100);

    expect(result).toEqual(new Uint8Array(0));
  });

  it("returns the bytes of a body under the limit", async () => {
    const { stream } = streamOf([bytes(10)]);

    const result = await readBodyWithLimit(stream, 100);

    expect(result).toEqual(bytes(10));
  });

  it("joins several chunks in order", async () => {
    const { stream } = streamOf([bytes(3, 1), bytes(2, 2), bytes(4, 3)]);

    const result = await readBodyWithLimit(stream, 100);

    expect(Array.from(result ?? [])).toEqual([1, 1, 1, 2, 2, 3, 3, 3, 3]);
  });

  it("accepts a body exactly at the limit", async () => {
    const { stream } = streamOf([bytes(6), bytes(4)]);

    const result = await readBodyWithLimit(stream, 10);

    expect(result).toHaveLength(10);
  });

  it("refuses a body one byte over the limit", async () => {
    const { stream } = streamOf([bytes(6), bytes(5)]);

    expect(await readBodyWithLimit(stream, 10)).toBeNull();
  });

  it("refuses when a single chunk is already over the limit", async () => {
    const { stream } = streamOf([bytes(50)]);

    expect(await readBodyWithLimit(stream, 10)).toBeNull();
  });

  it("stops reading and cancels the stream once over the limit", async () => {
    // 10 chunks of 5 bytes against a limit of 12: it must give up after 3, not read all 10
    const { stream, state } = streamOf(
      Array.from({ length: 10 }, () => bytes(5)),
    );

    const result = await readBodyWithLimit(stream, 12);

    expect(result).toBeNull();
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(10);
  });

  it("does not cancel a body that fits", async () => {
    const { stream, state } = streamOf([bytes(5)]);

    await readBodyWithLimit(stream, 100);

    expect(state.cancelled).toBe(false);
  });

  it("lets a broken stream throw", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("connection dropped");
      },
    });
    const onError = vi.fn();

    await readBodyWithLimit(stream, 100).catch(onError);

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
