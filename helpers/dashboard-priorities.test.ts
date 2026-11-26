import { describe, expect, it } from "vitest";
import {
  PRIORITY_VISIBLE_COUNT,
  deriveDashboardPriorities,
  getQuotaUsageLevel,
} from "@/helpers/dashboard-priorities";
import type { PriorityInput } from "@/types/dashboard";

// A healthy admin organization — each test changes only what it is about
const healthy: PriorityInput = {
  isAdmin: true,
  pendingHandoffCount: 0,
  botActive: true,
  quotaUsed: 27,
  quotaLimit: 100,
  subscriptionStatus: "active",
  failedDocumentCount: 0,
  staleEntryCount: 0,
};

const ids = (input: PriorityInput) =>
  deriveDashboardPriorities(input).items.map((item) => item.id);

describe("getQuotaUsageLevel", () => {
  it("is ok below 80%", () => {
    expect(getQuotaUsageLevel(79, 100)).toBe("ok");
  });

  it("warns from exactly 80%", () => {
    expect(getQuotaUsageLevel(80, 100)).toBe("warning");
    expect(getQuotaUsageLevel(99, 100)).toBe("warning");
  });

  it("is full at and above the limit", () => {
    expect(getQuotaUsageLevel(100, 100)).toBe("full");
    expect(getQuotaUsageLevel(120, 100)).toBe("full");
  });

  it("uses integer math, so 79.99% is not a warning", () => {
    expect(getQuotaUsageLevel(7999, 10000)).toBe("ok");
    expect(getQuotaUsageLevel(8000, 10000)).toBe("warning");
  });

  it("never flags a zero or negative limit", () => {
    expect(getQuotaUsageLevel(5, 0)).toBe("ok");
    expect(getQuotaUsageLevel(5, -1)).toBe("ok");
  });
});

describe("deriveDashboardPriorities", () => {
  it("shows the all-clear for a healthy admin organization", () => {
    const result = deriveDashboardPriorities(healthy);
    expect(result.items).toEqual([]);
    expect(result.allClear).toEqual({
      title: "Tidak ada tindakan mendesak",
      detail: "KUN aktif, tidak ada handoff tertunda, dan kuota masih aman.",
    });
  });

  it("shows pending handoffs first, linking to Percakapan", () => {
    const result = deriveDashboardPriorities({
      ...healthy,
      pendingHandoffCount: 2,
      subscriptionStatus: "past_due",
    });
    expect(result.items[0]).toMatchObject({
      id: "pending-handoff",
      tone: "danger",
      title: "2 handoff menunggu",
      href: "/dashboard/conversations",
    });
  });

  it("flags a past-due payment toward Billing without promising a date", () => {
    const [item] = deriveDashboardPriorities({
      ...healthy,
      subscriptionStatus: "past_due",
    }).items;
    expect(item).toMatchObject({
      id: "payment-past-due",
      tone: "danger",
      href: "/dashboard/billing",
    });
    expect(item?.detail).not.toMatch(/\d/);
  });

  it("does not flag payment states other than past_due", () => {
    for (const status of [
      "active",
      "free",
      "cancelled",
      "suspended",
    ] as const) {
      expect(ids({ ...healthy, subscriptionStatus: status })).toEqual([]);
    }
  });

  it("shows a quota warning with the real percentage", () => {
    const [item] = deriveDashboardPriorities({
      ...healthy,
      quotaUsed: 85,
    }).items;
    expect(item).toMatchObject({ id: "quota-warning", tone: "warning" });
    expect(item?.detail).toBe("85% kuota pesan telah digunakan.");
  });

  it("shows full quota instead of the warning, never both", () => {
    expect(ids({ ...healthy, quotaUsed: 100 })).toEqual(["quota-full"]);
    expect(ids({ ...healthy, quotaUsed: 150 })).toEqual(["quota-full"]);
  });

  it("asks to activate KUN when the bot is inactive or missing", () => {
    expect(ids({ ...healthy, botActive: false })).toEqual(["kun-inactive"]);
  });

  it("reports failed documents and stale entries with their counts", () => {
    const result = deriveDashboardPriorities({
      ...healthy,
      failedDocumentCount: 2,
      staleEntryCount: 5,
    });
    expect(result.items.map((item) => item.title)).toEqual([
      "2 dokumen gagal diproses",
      "5 entri belum tersinkron",
    ]);
    expect(
      result.items.every((item) => item.href === "/dashboard/knowledge"),
    ).toBe(true);
  });

  it("orders everything by urgency", () => {
    expect(
      ids({
        ...healthy,
        pendingHandoffCount: 1,
        subscriptionStatus: "past_due",
        quotaUsed: 100,
        botActive: false,
        failedDocumentCount: 1,
        staleEntryCount: 1,
      }),
    ).toEqual([
      "pending-handoff",
      "payment-past-due",
      "quota-full",
      "kun-inactive",
      "documents-failed",
      "knowledge-stale",
    ]);
  });

  it("puts the quota warning after KUN inactive and before knowledge items", () => {
    expect(
      ids({
        ...healthy,
        quotaUsed: 85,
        botActive: false,
        failedDocumentCount: 1,
      }),
    ).toEqual(["kun-inactive", "quota-warning", "documents-failed"]);
  });

  it("can produce more items than the card shows at once", () => {
    const all = ids({
      ...healthy,
      pendingHandoffCount: 1,
      subscriptionStatus: "past_due",
      quotaUsed: 100,
      botActive: false,
      failedDocumentCount: 1,
    });
    expect(all.length).toBeGreaterThan(PRIORITY_VISIBLE_COUNT);
  });

  describe("for a member", () => {
    const member: PriorityInput = {
      ...healthy,
      isAdmin: false,
      subscriptionStatus: "past_due",
      quotaUsed: 100,
      botActive: false,
      failedDocumentCount: 3,
      staleEntryCount: 4,
    };

    it("sees only the pending handoff", () => {
      expect(ids({ ...member, pendingHandoffCount: 1 })).toEqual([
        "pending-handoff",
      ]);
    });

    it("sees no admin items and a claim-free all-clear", () => {
      const result = deriveDashboardPriorities(member);
      expect(result.items).toEqual([]);
      expect(result.allClear.detail).toBe(
        "Tidak ada handoff tertunda saat ini.",
      );
    });
  });
});
