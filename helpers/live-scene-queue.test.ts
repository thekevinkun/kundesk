import { describe, expect, it } from "vitest";
import {
  COALESCE_MS,
  EMPTY_QUEUE,
  MAX_QUEUE,
  dequeueMoment,
  enqueueMoment,
} from "./live-scene-queue";
import type { SceneEventKind, SceneMoment } from "@/types/live-scene";

// Shorthand moment builder
const moment = (
  id: number,
  kind: SceneEventKind = "kun-reply",
): SceneMoment => ({
  id,
  kind,
});

describe("enqueueMoment", () => {
  it("adds a moment to an empty queue", () => {
    const state = enqueueMoment(EMPTY_QUEUE, moment(1), 1000);

    expect(state.queue).toEqual([moment(1)]);
    expect(state.last).toEqual({ kind: "kun-reply", at: 1000 });
  });

  it("drops the same kind inside the coalesce window", () => {
    const first = enqueueMoment(EMPTY_QUEUE, moment(1), 1000);
    const second = enqueueMoment(first, moment(2), 1000 + COALESCE_MS - 1);

    expect(second.queue).toHaveLength(1);
    expect(second.queue[0]?.id).toBe(1);
  });

  it("keeps the same kind once the window has passed", () => {
    const first = enqueueMoment(EMPTY_QUEUE, moment(1), 1000);
    const second = enqueueMoment(first, moment(2), 1000 + COALESCE_MS);

    expect(second.queue).toHaveLength(2);
  });

  it("never merges different kinds", () => {
    const first = enqueueMoment(
      EMPTY_QUEUE,
      moment(1, "handoff-requested"),
      1000,
    );
    const second = enqueueMoment(
      first,
      moment(2, "customer-message-admin"),
      1001,
    );

    expect(second.queue.map((item) => item.id)).toEqual([1, 2]);
  });

  it("keeps only the newest moments when a burst is long", () => {
    let state = EMPTY_QUEUE;
    // Alternate two kinds so nothing coalesces
    for (let id = 1; id <= 8; id += 1) {
      state = enqueueMoment(
        state,
        moment(id, id % 2 === 0 ? "kun-reply" : "admin-reply"),
        1000,
      );
    }

    expect(state.queue).toHaveLength(MAX_QUEUE);
    expect(state.queue.map((item) => item.id)).toEqual([4, 5, 6, 7, 8]);
  });
});

describe("dequeueMoment", () => {
  it("returns moments in the order they arrived", () => {
    let state = enqueueMoment(EMPTY_QUEUE, moment(1, "kun-reply"), 1000);
    state = enqueueMoment(state, moment(2, "admin-reply"), 1000);

    const first = dequeueMoment(state);
    const second = dequeueMoment(first.state);

    expect(first.next?.id).toBe(1);
    expect(second.next?.id).toBe(2);
  });

  it("reports an empty queue", () => {
    expect(dequeueMoment(EMPTY_QUEUE).next).toBeNull();
  });
});
