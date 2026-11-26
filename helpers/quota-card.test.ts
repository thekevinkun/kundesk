import { describe, expect, it } from "vitest";
import { quotaPercent } from "@/helpers/dashboard-priorities";
import { getQuotaCardState } from "@/helpers/quota-card";

describe("getQuotaCardState", () => {
  it("is calm and has no upgrade for a lightly used free plan", () => {
    expect(getQuotaCardState(27, 100, "free")).toEqual({
      level: "ok",
      barPercent: 27,
      remaining: 73,
      canUpgrade: false,
    });
  });

  it("warns from 80% and offers an upgrade on Free and Starter", () => {
    expect(getQuotaCardState(80, 100, "free")).toMatchObject({
      level: "warning",
      canUpgrade: true,
    });
    expect(getQuotaCardState(850, 1000, "starter")).toMatchObject({
      level: "warning",
      canUpgrade: true,
    });
  });

  it("is full at the limit with nothing remaining", () => {
    expect(getQuotaCardState(100, 100, "free")).toEqual({
      level: "full",
      barPercent: 100,
      remaining: 0,
      canUpgrade: true,
    });
  });

  it("caps the bar and the remainder when usage overshoots the limit", () => {
    const state = getQuotaCardState(120, 100, "starter");
    expect(state.barPercent).toBe(100);
    expect(state.remaining).toBe(0);
  });

  it("never offers an upgrade on Pro, the top plan", () => {
    expect(getQuotaCardState(9500, 10000, "pro").canUpgrade).toBe(false);
    expect(getQuotaCardState(10000, 10000, "pro").canUpgrade).toBe(false);
  });

  it("shows an empty bar for a zero limit instead of dividing by zero", () => {
    expect(getQuotaCardState(5, 0, "free")).toMatchObject({
      level: "ok",
      barPercent: 0,
      remaining: 0,
    });
  });
});

describe("quotaPercent", () => {
  it("rounds down and never exceeds 100", () => {
    expect(quotaPercent(85, 100)).toBe(85);
    expect(quotaPercent(999, 1000)).toBe(99);
    expect(quotaPercent(150, 100)).toBe(100);
    expect(quotaPercent(5, 0)).toBe(0);
  });
});
