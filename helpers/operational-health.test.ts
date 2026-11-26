import { describe, expect, it } from "vitest";
import {
  getHandoffFreeSummary,
  getHealthLabel,
} from "@/helpers/operational-health";

describe("getHandoffFreeSummary", () => {
  it("returns null when there are no conversations", () => {
    expect(getHandoffFreeSummary(0, 0)).toBeNull();
  });

  it("is 100% only when no conversation ever needed staff", () => {
    expect(getHandoffFreeSummary(40, 0)).toEqual({
      percent: 100,
      withoutStaff: 40,
      total: 40,
    });
  });

  it("rounds down, so one handoff in 1000 is 99%, never 100%", () => {
    expect(getHandoffFreeSummary(1000, 1)?.percent).toBe(99);
  });

  it("matches a plain example", () => {
    expect(getHandoffFreeSummary(62, 5)).toEqual({
      percent: 91,
      withoutStaff: 57,
      total: 62,
    });
  });

  it("clamps a handoff count above the total to 0%", () => {
    expect(getHandoffFreeSummary(3, 9)).toEqual({
      percent: 0,
      withoutStaff: 0,
      total: 3,
    });
  });

  it("treats a negative handoff count as zero", () => {
    expect(getHandoffFreeSummary(10, -2)?.percent).toBe(100);
  });
});

describe("getHealthLabel", () => {
  const calm = {
    pendingHandoffCount: 0,
    quotaLevel: "ok" as const,
    botActive: true,
  };

  it("says everything is normal when nothing is wrong", () => {
    expect(getHealthLabel(calm)).toBe("Operasional berjalan normal");
  });

  it("puts a waiting handoff before everything else", () => {
    expect(
      getHealthLabel({
        pendingHandoffCount: 1,
        quotaLevel: "full",
        botActive: false,
      }),
    ).toBe("Ada handoff yang perlu ditangani");
  });

  it("flags the quota from the warning level", () => {
    expect(getHealthLabel({ ...calm, quotaLevel: "warning" })).toBe(
      "Kuota perlu diperhatikan",
    );
    expect(getHealthLabel({ ...calm, quotaLevel: "full" })).toBe(
      "Kuota perlu diperhatikan",
    );
  });

  it("says KUN is inactive only when nothing more urgent applies", () => {
    expect(getHealthLabel({ ...calm, botActive: false })).toBe(
      "KUN sedang nonaktif",
    );
  });
});
