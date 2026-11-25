import { describe, expect, it } from "vitest";
import { getQuotaCrossing } from "./live-scene";

// Shorthand usage builder against a limit of 100
const at = (used: number, limit = 100) => ({ used, limit });

describe("getQuotaCrossing", () => {
  it("fires the warning when usage reaches exactly 80%", () => {
    expect(getQuotaCrossing(at(79), at(80))).toBe("quota-warning");
  });

  it("fires full when usage reaches the limit", () => {
    expect(getQuotaCrossing(at(99), at(100))).toBe("quota-full");
  });

  it("fires full when usage jumps from ok straight to the limit", () => {
    expect(getQuotaCrossing(at(50), at(100))).toBe("quota-full");
  });

  it("stays silent while the level does not change", () => {
    expect(getQuotaCrossing(at(10), at(11))).toBeNull();
    expect(getQuotaCrossing(at(85), at(86))).toBeNull();
    expect(getQuotaCrossing(at(100), at(101))).toBeNull();
  });

  it("stays silent when the level goes down (reset or a higher limit)", () => {
    expect(getQuotaCrossing(at(100), at(0))).toBeNull();
    expect(getQuotaCrossing(at(100), at(100, 1000))).toBeNull();
  });
});
