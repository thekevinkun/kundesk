import { describe, expect, it } from "vitest";
import {
  getRowAttention,
  isUnreadForStaff,
  splitAttention,
} from "@/helpers/conversation-attention";
import type { ConversationAttentionCandidate } from "@/types/dashboard";

// Builds a candidate from ISO strings
const candidate = (
  id: number,
  handoffStatus: string,
  lastMessageAt: string,
  staffReadAt: string | null,
): ConversationAttentionCandidate => ({
  id,
  handoffStatus,
  lastMessageAt: new Date(lastMessageAt),
  staffReadAt: staffReadAt ? new Date(staffReadAt) : null,
});

describe("isUnreadForStaff", () => {
  it("keeps a pending handoff unread even after staff opened it", () => {
    expect(
      isUnreadForStaff(
        candidate(
          1,
          "pending_handoff",
          "2026-11-26T10:00:00Z",
          "2026-11-26T11:00:00Z",
        ),
      ),
    ).toBe(true);
  });

  it("treats a manual chat nobody opened as unread", () => {
    expect(
      isUnreadForStaff(candidate(1, "human", "2026-11-26T10:00:00Z", null)),
    ).toBe(true);
  });

  it("treats a manual chat opened before the customer wrote as unread", () => {
    expect(
      isUnreadForStaff(
        candidate(1, "human", "2026-11-26T10:00:00Z", "2026-11-26T09:00:00Z"),
      ),
    ).toBe(true);
  });

  it("treats a manual chat opened after the customer wrote as read", () => {
    expect(
      isUnreadForStaff(
        candidate(1, "human", "2026-11-26T10:00:00Z", "2026-11-26T10:30:00Z"),
      ),
    ).toBe(false);
  });

  it("counts the same instant as read", () => {
    expect(
      isUnreadForStaff(
        candidate(1, "human", "2026-11-26T10:00:00Z", "2026-11-26T10:00:00Z"),
      ),
    ).toBe(false);
  });
});

describe("splitAttention", () => {
  it("splits unread from awaiting and keeps the input order", () => {
    const result = splitAttention([
      candidate(1, "human", "2026-11-26T10:00:00Z", "2026-11-26T10:30:00Z"),
      candidate(
        2,
        "pending_handoff",
        "2026-11-26T10:00:00Z",
        "2026-11-26T11:00:00Z",
      ),
      candidate(3, "human", "2026-11-26T10:00:00Z", null),
      candidate(4, "human", "2026-11-26T10:00:00Z", "2026-11-26T10:45:00Z"),
    ]);
    expect(result.unreadIds).toEqual([2, 3]);
    expect(result.awaitingIds).toEqual([1, 4]);
  });

  it("returns empty lists for no candidates", () => {
    expect(splitAttention([])).toEqual({ unreadIds: [], awaitingIds: [] });
  });
});

describe("getRowAttention", () => {
  const unread = new Set([1, 2]);
  const awaiting = new Set([3]);

  it("marks unread and awaiting manual rows", () => {
    expect(getRowAttention("human", 1, unread, awaiting)).toBe("unread");
    expect(getRowAttention("human", 3, unread, awaiting)).toBe("awaiting");
  });

  it("marks nothing for other rows", () => {
    expect(getRowAttention("ai", 9, unread, awaiting)).toBeNull();
    expect(getRowAttention("human", 9, unread, awaiting)).toBeNull();
  });

  it("never adds a second marker to a pending row", () => {
    expect(getRowAttention("pending_handoff", 2, unread, awaiting)).toBeNull();
  });
});
