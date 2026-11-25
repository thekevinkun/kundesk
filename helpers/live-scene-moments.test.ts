import { describe, expect, it } from "vitest";
import {
  POPUP_POSITIONS,
  RING_SECONDS,
  SCENE_MOMENTS,
  getPacketDurationSeconds,
  getPacketKeyframes,
} from "./live-scene-moments";

describe("getPacketKeyframes", () => {
  it("places one stop per anchor, evenly spaced", () => {
    const frames = getPacketKeyframes(["customer", "kun", "admin"]);

    expect(frames.left).toEqual(["18%", "50%", "82%"]);
    expect(frames.times).toEqual([0, 0.5, 1]);
  });

  it("handles a single thread", () => {
    const frames = getPacketKeyframes(["kun", "customer"]);

    expect(frames.times).toEqual([0, 1]);
    expect(frames.top).toHaveLength(2);
  });
});

describe("getPacketDurationSeconds", () => {
  it("scales with the number of threads crossed", () => {
    expect(getPacketDurationSeconds(["kun", "admin"])).toBeCloseTo(0.9);
    expect(getPacketDurationSeconds(["admin", "kun", "customer"])).toBeCloseTo(
      1.8,
    );
  });
});

describe("SCENE_MOMENTS", () => {
  it("holds the stage long enough for the packet and its landing ring", () => {
    for (const spec of Object.values(SCENE_MOMENTS)) {
      if (!spec.route) continue;
      const needed =
        (getPacketDurationSeconds(spec.route) + RING_SECONDS) * 1000;
      expect(spec.durationMs).toBeGreaterThanOrEqual(needed);
    }
  });

  it("has a position for every pop-up anchor", () => {
    for (const spec of Object.values(SCENE_MOMENTS)) {
      if (spec.popup) expect(POPUP_POSITIONS[spec.popup.anchor]).toBeDefined();
    }
  });

  it("gives every moment a screen-reader announcement", () => {
    for (const spec of Object.values(SCENE_MOMENTS)) {
      expect(spec.announce.length).toBeGreaterThan(0);
    }
  });

  it("shows quota moments as pop-ups only, without a packet", () => {
    expect(SCENE_MOMENTS["quota-warning"].route).toBeNull();
    expect(SCENE_MOMENTS["quota-full"].route).toBeNull();
    expect(SCENE_MOMENTS["quota-full"].popup?.tone).toBe("danger");
  });
});
