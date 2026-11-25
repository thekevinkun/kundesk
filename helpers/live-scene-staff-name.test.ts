import { describe, expect, it } from "vitest";
import { deriveSceneState } from "./live-scene";
import type { SceneInput } from "@/types/live-scene";

// Preview in a given handoff state with a recorded taker
const previewWith = (
  handoffStatus: "ai" | "pending_handoff" | "human",
  takenOverBy: string | null,
): SceneInput["preview"] => ({
  sessionId: "abcdef123456",
  deliveryChannel: "web_widget",
  handoffStatus,
  takenOverBy,
});

// Viewer is Kevin; each test overrides only what it cares about
const makeInput = (overrides: Partial<SceneInput> = {}): SceneInput => ({
  preview: previewWith("human", "user_rina"),
  botActive: true,
  quotaUsed: 10,
  quotaLimit: 100,
  viewerUserId: "user_me",
  viewerName: "Kevin",
  ...overrides,
});

describe("admin name for another staff member", () => {
  it("shows the resolved first name", () => {
    const scene = deriveSceneState(makeInput({ takenOverByName: "Rina" }));

    expect(scene.adminName).toBe("Rina");
    expect(scene.adminOwnership).toBe("other");
  });

  it("falls back to 'Staf lain' when no name could be resolved", () => {
    for (const takenOverByName of [null, undefined, "", "   "]) {
      const scene = deriveSceneState(makeInput({ takenOverByName }));

      expect(scene.adminName).toBe("Staf lain");
      expect(scene.adminOwnership).toBe("other");
    }
  });

  it("keeps showing the viewer's own name for the viewer's own takeover", () => {
    const scene = deriveSceneState(
      makeInput({
        preview: previewWith("human", "user_me"),
        takenOverByName: "Rina",
      }),
    );

    expect(scene.adminName).toBe("Kevin (Anda)");
    expect(scene.adminOwnership).toBe("viewer");
  });

  it("ignores a resolved name once the conversation is back with KUN", () => {
    const scene = deriveSceneState(
      makeInput({
        preview: previewWith("ai", "user_rina"),
        takenOverByName: "Rina",
      }),
    );

    expect(scene.adminName).toBe("Kevin");
    expect(scene.adminOwnership).toBe("none");
  });

  it("still uses the neutral label when nobody was recorded", () => {
    const scene = deriveSceneState(
      makeInput({
        preview: previewWith("human", null),
        takenOverByName: "Rina",
      }),
    );

    expect(scene.adminName).toBe("Staf");
    expect(scene.adminOwnership).toBe("unknown");
  });
});
