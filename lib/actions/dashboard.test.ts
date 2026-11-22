import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  getOwnerTimezone: vi.fn(),
  getLiveOverviewSnapshot: vi.fn(),
  getLiveConversationPreview: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("@/lib/timezone", () => ({ getOwnerTimezone: mocks.getOwnerTimezone }));
vi.mock("@/lib/db/queries/dashboard", () => ({
  getLiveOverviewSnapshot: mocks.getLiveOverviewSnapshot,
  getLiveConversationPreview: mocks.getLiveConversationPreview,
}));

import {
  getLiveConversationPreviewAction,
  getLiveOverviewSnapshotAction,
} from "./dashboard";

describe("getLiveOverviewSnapshotAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses only the authenticated org and its timezone", async () => {
    const snapshot = { stats: {}, queue: {}, bot: null, organization: {} };
    mocks.requireOrg.mockResolvedValue({ userId: "user_1", orgId: "org_safe" });
    mocks.getOwnerTimezone.mockResolvedValue("Asia/Makassar");
    mocks.getLiveOverviewSnapshot.mockResolvedValue(snapshot);

    await expect(getLiveOverviewSnapshotAction()).resolves.toBe(snapshot);
    expect(mocks.getLiveOverviewSnapshot).toHaveBeenCalledWith(
      "org_safe",
      "Asia/Makassar",
    );
  });

  it("does not query data when the caller has no active organization", async () => {
    mocks.requireOrg.mockRejectedValue(new Error("No active organization"));

    await expect(getLiveOverviewSnapshotAction()).rejects.toThrow(
      "No active organization",
    );
    expect(mocks.getLiveOverviewSnapshot).not.toHaveBeenCalled();
  });
});

describe("getLiveConversationPreviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses only the authenticated org", async () => {
    const preview = { id: 1, sessionId: "session_1", messages: [] };
    mocks.requireOrg.mockResolvedValue({ userId: "user_1", orgId: "org_safe" });
    mocks.getLiveConversationPreview.mockResolvedValue(preview);

    await expect(getLiveConversationPreviewAction()).resolves.toBe(preview);
    expect(mocks.getLiveConversationPreview).toHaveBeenCalledWith("org_safe");
  });

  it("does not query data when the caller has no active organization", async () => {
    mocks.requireOrg.mockRejectedValue(new Error("No active organization"));

    await expect(getLiveConversationPreviewAction()).rejects.toThrow(
      "No active organization",
    );
    expect(mocks.getLiveConversationPreview).not.toHaveBeenCalled();
  });
});
