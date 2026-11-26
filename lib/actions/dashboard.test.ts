import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  getOwnerTimezone: vi.fn(),
  getLiveOverviewSnapshot: vi.fn(),
  getLiveConversationPreview: vi.fn(),
  getHumanUnreadConversationIds: vi.fn(),
  getAwaitingReplyConversationIds: vi.fn(),
  markConversationRead: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("@/lib/timezone", () => ({ getOwnerTimezone: mocks.getOwnerTimezone }));
vi.mock("@/lib/db/queries/dashboard", () => ({
  getLiveOverviewSnapshot: mocks.getLiveOverviewSnapshot,
  getLiveConversationPreview: mocks.getLiveConversationPreview,
  getHumanUnreadConversationIds: mocks.getHumanUnreadConversationIds,
  getAwaitingReplyConversationIds: mocks.getAwaitingReplyConversationIds,
  markConversationRead: mocks.markConversationRead,
}));

import {
  getAwaitingReplyConversationIdsAction,
  getHumanUnreadConversationIdsAction,
  getLiveConversationPreviewAction,
  getLiveOverviewSnapshotAction,
  markConversationReadAction,
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

describe("markConversationReadAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps earlier rejections, so every default is set again here
    mocks.requireOrg.mockResolvedValue({ userId: "user_1", orgId: "org_safe" });
    mocks.markConversationRead.mockResolvedValue(undefined);
  });

  it("marks the conversation read for the org of the session", async () => {
    await expect(markConversationReadAction(42)).resolves.toEqual({
      success: true,
      data: undefined,
    });
    expect(mocks.markConversationRead).toHaveBeenCalledWith(42, "org_safe");
  });

  it.each([
    ["zero", 0],
    ["a negative number", -1],
    ["a decimal", 1.5],
    ["a numeric string", "5"],
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("rejects %s before auth or the database", async (_label, input) => {
    await expect(markConversationReadAction(input)).resolves.toEqual({
      success: false,
      error: "Invalid conversation",
    });
    expect(mocks.requireOrg).not.toHaveBeenCalled();
    expect(mocks.markConversationRead).not.toHaveBeenCalled();
  });

  it("never reaches the write when the caller has no active organization", async () => {
    mocks.requireOrg.mockRejectedValue(new Error("No active organization"));

    await expect(markConversationReadAction(42)).rejects.toThrow(
      "No active organization",
    );
    expect(mocks.markConversationRead).not.toHaveBeenCalled();
  });

  it("lets a database failure surface instead of reporting success", async () => {
    mocks.markConversationRead.mockRejectedValue(new Error("neon timeout"));

    await expect(markConversationReadAction(42)).rejects.toThrow(
      "neon timeout",
    );
  });
});

describe("conversation attention list actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrg.mockResolvedValue({ userId: "user_1", orgId: "org_safe" });
    mocks.getAwaitingReplyConversationIds.mockResolvedValue([3, 4]);
    mocks.getHumanUnreadConversationIds.mockResolvedValue([1, 2]);
  });

  it("returns the awaiting ids of the session's org only", async () => {
    await expect(getAwaitingReplyConversationIdsAction()).resolves.toEqual([
      3, 4,
    ]);
    expect(mocks.getAwaitingReplyConversationIds).toHaveBeenCalledWith(
      "org_safe",
    );
  });

  it("returns the unread ids of the session's org only", async () => {
    await expect(getHumanUnreadConversationIdsAction()).resolves.toEqual([
      1, 2,
    ]);
    expect(mocks.getHumanUnreadConversationIds).toHaveBeenCalledWith(
      "org_safe",
    );
  });

  it("does not query anything when the caller has no active organization", async () => {
    mocks.requireOrg.mockRejectedValue(new Error("No active organization"));

    await expect(getAwaitingReplyConversationIdsAction()).rejects.toThrow(
      "No active organization",
    );
    await expect(getHumanUnreadConversationIdsAction()).rejects.toThrow(
      "No active organization",
    );
    expect(mocks.getAwaitingReplyConversationIds).not.toHaveBeenCalled();
    expect(mocks.getHumanUnreadConversationIds).not.toHaveBeenCalled();
  });
});
