import { describe, expect, it } from "vitest";
import { AVATAR_PALETTES, DEFAULT_LOOK, getAvatarLook } from "./avatar-look";

describe("getAvatarLook", () => {
  it("returns the same look for the same seed", () => {
    expect(getAvatarLook("session-abc")).toEqual(getAvatarLook("session-abc"));
  });

  it("returns the default look when there is no seed", () => {
    expect(getAvatarLook(null)).toEqual(DEFAULT_LOOK);
    expect(getAvatarLook(undefined)).toEqual(DEFAULT_LOOK);
    expect(getAvatarLook("")).toEqual(DEFAULT_LOOK);
  });

  it("only uses colors and hair styles from the palettes", () => {
    for (let i = 0; i < 200; i += 1) {
      const look = getAvatarLook(`session-${i}`);
      expect(AVATAR_PALETTES.skin).toContain(look.skin);
      expect(AVATAR_PALETTES.hair).toContain(look.hair);
      expect(AVATAR_PALETTES.shirt).toContain(look.shirt);
      expect(AVATAR_PALETTES.hairStyle).toContain(look.hairStyle);
    }
  });

  it("gives different sessions visibly different looks", () => {
    const looks = Array.from({ length: 50 }, (_, i) =>
      JSON.stringify(getAvatarLook(`session-${i}`)),
    );
    // I checked 48 distinct looks in 50 seeds; the bar is set well below that
    expect(new Set(looks).size).toBeGreaterThan(20);
  });
});
