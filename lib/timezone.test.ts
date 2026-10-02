// Tests getOwnerTimezone: org timezone from the session's org, with safe fallbacks
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getOrgTimezone: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db/queries/org-timezone", () => ({
  getOrgTimezone: mocks.getOrgTimezone,
}));

import { getOwnerTimezone } from "./timezone";

describe("getOwnerTimezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the timezone of the session's org", async () => {
    mocks.getSession.mockResolvedValue({ userId: "u1", orgId: "org_1" });
    mocks.getOrgTimezone.mockResolvedValue("Asia/Makassar");
    expect(await getOwnerTimezone()).toBe("Asia/Makassar");
    expect(mocks.getOrgTimezone).toHaveBeenCalledWith("org_1");
  });

  it("falls back to the default without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect(await getOwnerTimezone()).toBe("Asia/Jakarta");
    expect(mocks.getOrgTimezone).not.toHaveBeenCalled();
  });

  it("falls back to the default when the lookup throws", async () => {
    mocks.getSession.mockResolvedValue({ userId: "u1", orgId: "org_1" });
    mocks.getOrgTimezone.mockRejectedValue(new Error("neon down"));
    expect(await getOwnerTimezone()).toBe("Asia/Jakarta");
  });
});
