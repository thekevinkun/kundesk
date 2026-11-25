import { describe, expect, it } from "vitest";
import { getKunReplyKind } from "./live-scene";
import { SCENE_MOMENTS } from "./live-scene-moments";

describe("getKunReplyKind", () => {
  it("plays the whole exchange for a later AI-mode message", () => {
    expect(
      getKunReplyKind({ customerShownRecently: false, handoffStatus: "ai" }),
    ).toBe("kun-exchange");
    expect(
      getKunReplyKind({ customerShownRecently: false, handoffStatus: null }),
    ).toBe("kun-exchange");
  });

  it("plays only the reply when the customer leg was just drawn", () => {
    expect(
      getKunReplyKind({ customerShownRecently: true, handoffStatus: "ai" }),
    ).toBe("kun-reply");
  });

  it("plays only the reply for canned messages during staff modes", () => {
    expect(
      getKunReplyKind({
        customerShownRecently: false,
        handoffStatus: "pending_handoff",
      }),
    ).toBe("kun-reply");
    expect(
      getKunReplyKind({ customerShownRecently: false, handoffStatus: "human" }),
    ).toBe("kun-reply");
  });
});

describe("message moment colors", () => {
  it("draws message traffic as bright red dots", () => {
    for (const kind of [
      "customer-message-ai",
      "customer-message-admin",
      "kun-reply",
      "kun-exchange",
      "admin-reply",
    ] as const) {
      expect(SCENE_MOMENTS[kind].tone).toBe("signal");
    }
  });

  it("keeps handoff moments amber and a full quota red", () => {
    expect(SCENE_MOMENTS["handoff-requested"].tone).toBe("warning");
    expect(SCENE_MOMENTS.takeover.tone).toBe("warning");
    expect(SCENE_MOMENTS["quota-full"].tone).toBe("danger");
  });

  it("plays the exchange as a round trip that ends at the customer", () => {
    expect(SCENE_MOMENTS["kun-exchange"].route).toEqual([
      "customer",
      "kun",
      "customer",
    ]);
  });
});
