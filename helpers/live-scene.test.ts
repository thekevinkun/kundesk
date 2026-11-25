import { describe, expect, it } from "vitest";
import { deriveSceneState, getChannelLabel, getQuotaLevel } from "./live-scene";
import type { SceneInput } from "@/types/live-scene";

// Valid baseline input — each test overrides only what it cares about
const makeInput = (overrides: Partial<SceneInput> = {}): SceneInput => ({
  preview: {
    sessionId: "abcdef123456",
    deliveryChannel: "whatsapp",
    handoffStatus: "ai",
    takenOverBy: null,
  },
  botActive: true,
  quotaUsed: 10,
  quotaLimit: 100,
  viewerUserId: "user_me",
  viewerName: "Kevin",
  ...overrides,
});

// Shorthand for a preview in a given handoff state
const previewWith = (
  handoffStatus: "ai" | "pending_handoff" | "human",
  takenOverBy: string | null = null,
): SceneInput["preview"] => ({
  sessionId: "abcdef123456",
  deliveryChannel: "web_widget",
  handoffStatus,
  takenOverBy,
});

describe("getQuotaLevel", () => {
  it("is ok below 80%", () => {
    expect(getQuotaLevel(79, 100)).toBe("ok");
    expect(getQuotaLevel(799, 1000)).toBe("ok");
  });

  it("is warning from exactly 80% up to the limit", () => {
    expect(getQuotaLevel(80, 100)).toBe("warning");
    expect(getQuotaLevel(99, 100)).toBe("warning");
    expect(getQuotaLevel(800, 1000)).toBe("warning");
  });

  it("is full at and above the limit", () => {
    expect(getQuotaLevel(100, 100)).toBe("full");
    expect(getQuotaLevel(120, 100)).toBe("full");
  });

  it("treats a zero or negative limit as ok", () => {
    expect(getQuotaLevel(0, 0)).toBe("ok");
    expect(getQuotaLevel(5, -1)).toBe("ok");
  });
});

describe("getChannelLabel", () => {
  it("maps the known channels", () => {
    expect(getChannelLabel("whatsapp")).toBe("WhatsApp");
    expect(getChannelLabel("qr_link")).toBe("QR");
    expect(getChannelLabel("web_widget")).toBe("Web");
  });

  it("falls back for an unknown channel", () => {
    expect(getChannelLabel("telegram")).toBe("Chat");
  });
});

describe("deriveSceneState", () => {
  it("shows an empty customer spot when there is no live conversation", () => {
    const scene = deriveSceneState(makeInput({ preview: null }));

    expect(scene.mode).toBe("ai");
    expect(scene.statusLabel).toBe("KUN menangani percakapan");
    expect(scene.customerPose).toBe("absent");
    expect(scene.channelLabel).toBeNull();
    expect(scene.sessionLabel).toBeNull();
    expect(scene.adminPose).toBe("idle");
    expect(scene.adminName).toBe("Kevin");
    expect(scene.adminOwnership).toBe("none");
  });

  it("builds the customer labels from the real session and channel", () => {
    const scene = deriveSceneState(makeInput());

    expect(scene.customerPose).toBe("idle");
    expect(scene.channelLabel).toBe("WhatsApp");
    expect(scene.sessionLabel).toBe("#abcdef12");
  });

  it("turns KUN off when the bot is inactive", () => {
    const scene = deriveSceneState(makeInput({ botActive: false }));

    expect(scene.kunPose).toBe("off");
    expect(scene.statusLabel).toBe("KUN sedang nonaktif");
  });

  it("makes an active KUN tired at a full quota, but keeps an inactive KUN off", () => {
    const full = deriveSceneState(makeInput({ quotaUsed: 100 }));
    const fullAndOff = deriveSceneState(
      makeInput({ quotaUsed: 100, botActive: false }),
    );

    expect(full.quotaLevel).toBe("full");
    expect(full.kunPose).toBe("tired");
    expect(fullAndOff.kunPose).toBe("off");
  });

  it("alerts the admin and raises the customer's hand while a handoff is pending", () => {
    const scene = deriveSceneState(
      makeInput({ preview: previewWith("pending_handoff") }),
    );

    expect(scene.mode).toBe("pending");
    expect(scene.customerPose).toBe("waiting");
    expect(scene.adminPose).toBe("alerted");
    expect(scene.statusLabel).toBe("Menunggu admin mengambil alih");
  });

  it("keeps the pending label even when KUN is inactive", () => {
    const scene = deriveSceneState(
      makeInput({ preview: previewWith("pending_handoff"), botActive: false }),
    );

    expect(scene.statusLabel).toBe("Menunggu admin mengambil alih");
  });

  it("names the viewer when the viewer took over", () => {
    const scene = deriveSceneState(
      makeInput({ preview: previewWith("human", "user_me") }),
    );

    expect(scene.mode).toBe("manual");
    expect(scene.adminPose).toBe("working");
    expect(scene.adminName).toBe("Kevin (Anda)");
    expect(scene.adminOwnership).toBe("viewer");
    expect(scene.statusLabel).toBe("Admin menangani percakapan");
  });

  it("never shows the viewer's name for another staff member's work", () => {
    const scene = deriveSceneState(
      makeInput({ preview: previewWith("human", "user_other") }),
    );

    expect(scene.adminName).toBe("Staf lain");
    expect(scene.adminOwnership).toBe("other");
  });

  it("uses a neutral label when manual mode has no recorded taker", () => {
    const scene = deriveSceneState(
      makeInput({ preview: previewWith("human", null) }),
    );

    expect(scene.adminName).toBe("Staf");
    expect(scene.adminOwnership).toBe("unknown");
  });

  it("ignores a stale takenOverBy once the conversation is back with KUN", () => {
    const scene = deriveSceneState(
      makeInput({ preview: previewWith("ai", "user_other") }),
    );

    expect(scene.adminOwnership).toBe("none");
    expect(scene.adminName).toBe("Kevin");
  });

  it("falls back to 'Admin' when the viewer has no name", () => {
    const idle = deriveSceneState(makeInput({ viewerName: null }));
    const taken = deriveSceneState(
      makeInput({
        viewerName: null,
        preview: previewWith("human", "user_me"),
      }),
    );

    expect(idle.adminName).toBe("Admin");
    expect(taken.adminName).toBe("Admin (Anda)");
  });
});
