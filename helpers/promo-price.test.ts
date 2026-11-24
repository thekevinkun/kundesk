// Unit tests for the promo price helper

import { describe, it, expect } from "vitest";
import { applyPromoDiscount } from "./promo-price";

describe("applyPromoDiscount", () => {
  it("applies 98% to the Pro price", () => {
    expect(applyPromoDiscount(149000, 98)).toBe(2980);
  });

  it("applies 98% to the Starter price", () => {
    expect(applyPromoDiscount(79000, 98)).toBe(1580);
  });

  it("returns the price unchanged at 0%", () => {
    expect(applyPromoDiscount(79000, 0)).toBe(79000);
  });

  it("returns 0 at 100%", () => {
    expect(applyPromoDiscount(79000, 100)).toBe(0);
  });

  it("rounds down to a whole rupiah", () => {
    expect(applyPromoDiscount(79000, 33)).toBe(52930);
    expect(applyPromoDiscount(99999, 50)).toBe(49999);
  });
});
