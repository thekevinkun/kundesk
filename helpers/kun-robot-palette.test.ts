import { describe, expect, it } from "vitest";
import { KUN_GRADIENTS, getKunPalette } from "./kun-robot-palette";

describe("getKunPalette", () => {
  it("dresses an active KUN in gold", () => {
    const palette = getKunPalette("active");

    expect(palette.body).toBe(`url(#${KUN_GRADIENTS.goldBody})`);
    expect(palette.dark).toBe(`url(#${KUN_GRADIENTS.goldDark})`);
    expect(palette.visor).toBe(`url(#${KUN_GRADIENTS.visor})`);
    expect(palette.opacity).toBe(1);
  });

  it("keeps the same gold when the quota is full", () => {
    expect(getKunPalette("tired")).toEqual(getKunPalette("active"));
  });

  it("turns an inactive KUN steel grey and dimmer", () => {
    const palette = getKunPalette("off");

    expect(palette.body).toBe(`url(#${KUN_GRADIENTS.steelBody})`);
    expect(palette.visor).toBe(`url(#${KUN_GRADIENTS.visorOff})`);
    expect(palette.opacity).toBeLessThan(1);
    expect(palette.tileClass).not.toBe(getKunPalette("active").tileClass);
  });
});
