import { describe, expect, it } from "vitest";
import {
  QUEUE_CAP_DESKTOP,
  QUEUE_CAP_MOBILE,
  QUEUE_FETCH_LIMIT,
  countQueue,
  filterQueue,
  getQueueOverflow,
  sortQueue,
} from "@/helpers/conversation-queue";

// Builds a queue row with only the fields the helpers read
const row = (
  id: number,
  handoffStatus: string,
  lastMessageAt: string | null,
  createdAt = "2026-11-26T00:00:00.000Z",
) => ({ id, handoffStatus, lastMessageAt, createdAt });

describe("sortQueue", () => {
  it("puts pending handoffs first, then newest activity", () => {
    const rows = [
      row(1, "ai", "2026-11-26T10:00:00.000Z"),
      row(2, "pending_handoff", "2026-11-26T08:00:00.000Z"),
      row(3, "human", "2026-11-26T11:00:00.000Z"),
    ];
    expect(sortQueue(rows).map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("falls back to createdAt when there is no message time", () => {
    const rows = [
      row(1, "ai", "2026-11-26T08:00:00.000Z"),
      row(2, "ai", null, "2026-11-26T09:00:00.000Z"),
    ];
    expect(sortQueue(rows).map((r) => r.id)).toEqual([2, 1]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      row(1, "ai", "2026-11-26T08:00:00.000Z"),
      row(2, "pending_handoff", "2026-11-26T07:00:00.000Z"),
    ];
    sortQueue(rows);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });
});

describe("filterQueue", () => {
  const rows = [
    row(1, "ai", "2026-11-26T10:00:00.000Z"),
    row(2, "human", "2026-11-26T09:00:00.000Z"),
    row(3, "pending_handoff", "2026-11-26T08:00:00.000Z"),
    row(4, "ai", "2026-11-26T07:00:00.000Z"),
  ];

  it("keeps everything for all, as a new array", () => {
    const result = filterQueue(rows, "all");
    expect(result.map((r) => r.id)).toEqual([1, 2, 3, 4]);
    expect(result).not.toBe(rows);
  });

  it("selects one status per chip", () => {
    expect(filterQueue(rows, "ai").map((r) => r.id)).toEqual([1, 4]);
    expect(filterQueue(rows, "human").map((r) => r.id)).toEqual([2]);
    expect(filterQueue(rows, "pending_handoff").map((r) => r.id)).toEqual([3]);
  });

  it("treats an unexpected status as KUN, like the status pill", () => {
    const odd = [row(9, "weird", "2026-11-26T10:00:00.000Z")];
    expect(filterQueue(odd, "ai")).toHaveLength(1);
    expect(countQueue(odd).ai).toBe(1);
  });
});

describe("countQueue", () => {
  it("counts every chip and the total", () => {
    const rows = [
      row(1, "ai", null),
      row(2, "ai", null),
      row(3, "human", null),
      row(4, "pending_handoff", null),
    ];
    expect(countQueue(rows)).toEqual({
      all: 4,
      pending_handoff: 1,
      ai: 2,
      human: 1,
    });
  });

  it("returns zeros for an empty queue", () => {
    expect(countQueue([])).toEqual({
      all: 0,
      pending_handoff: 0,
      ai: 0,
      human: 0,
    });
  });
});

describe("getQueueOverflow", () => {
  it("hides nothing at or below the cap", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(i, "ai", null));
    expect(getQueueOverflow(rows, QUEUE_CAP_DESKTOP)).toEqual({
      hidden: 0,
      hiddenPending: 0,
    });
  });

  it("counts hidden rows without any hidden pending", () => {
    const rows = [
      row(1, "pending_handoff", null),
      ...Array.from({ length: 7 }, (_, i) => row(i + 2, "ai", null)),
    ];
    expect(getQueueOverflow(rows, QUEUE_CAP_DESKTOP)).toEqual({
      hidden: 3,
      hiddenPending: 0,
    });
  });

  it("reports hidden pending rows only when pending alone exceeds the cap", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => row(i, "pending_handoff", null)),
      row(10, "ai", null),
    ];
    expect(getQueueOverflow(rows, QUEUE_CAP_DESKTOP)).toEqual({
      hidden: 2,
      hiddenPending: 1,
    });
  });

  it("hides more on mobile than on desktop", () => {
    const rows = Array.from({ length: 4 }, (_, i) => row(i, "ai", null));
    expect(QUEUE_CAP_MOBILE).toBeLessThan(QUEUE_CAP_DESKTOP);
    expect(getQueueOverflow(rows, QUEUE_CAP_MOBILE).hidden).toBe(1);
    expect(getQueueOverflow(rows, QUEUE_CAP_DESKTOP).hidden).toBe(0);
  });
});

describe("queue limits", () => {
  it("fetches more rows than it displays, so chip counts cover hidden rows", () => {
    expect(QUEUE_FETCH_LIMIT).toBeGreaterThan(QUEUE_CAP_DESKTOP);
  });
});
