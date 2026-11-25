import { describe, expect, it } from "vitest";
import { getAvatarLook, getStaffLook } from "./avatar-look";

describe("getStaffLook", () => {
  it("always uses the neutral hair, whatever the seed", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(getStaffLook(`user_${i}`).hairStyle).toBe("neutral");
    }
  });

  it("uses the neutral hair when there is no seed", () => {
    expect(getStaffLook(null).hairStyle).toBe("neutral");
    expect(getStaffLook(undefined).hairStyle).toBe("neutral");
    expect(getStaffLook("").hairStyle).toBe("neutral");
  });

  it("keeps the seeded colors, so teammates still look different", () => {
    const customer = getAvatarLook("user_abc");
    const staff = getStaffLook("user_abc");

    expect(staff.skin).toBe(customer.skin);
    expect(staff.hair).toBe(customer.hair);
    expect(staff.shirt).toBe(customer.shirt);
  });

  it("gives the same look for the same person every time", () => {
    expect(getStaffLook("user_abc")).toEqual(getStaffLook("user_abc"));
  });
});

describe("customer looks", () => {
  it("never get the staff-only neutral hair", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(getAvatarLook(`session-${i}`).hairStyle).not.toBe("neutral");
    }
  });
});
