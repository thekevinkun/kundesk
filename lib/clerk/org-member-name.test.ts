import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted so the mock factories can reach them and beforeEach can re-set them
const mocks = vi.hoisted(() => ({
  clerkClient: vi.fn(),
  getMembershipList: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ clerkClient: mocks.clerkClient }));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import {
  FAILURE_COOLDOWN_MS,
  NAME_TTL_MS,
  clearOrgMemberNameCache,
  getOrgMemberFirstName,
} from "./org-member-name";

// Shape Clerk returns for a membership lookup
const found = (firstName: string | null) => ({
  data: [{ publicUserData: { firstName } }],
});

describe("getOrgMemberFirstName", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearOrgMemberNameCache();
    // Only Date is faked — promises must keep working
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
    mocks.clerkClient.mockResolvedValue({
      organizations: { getOrganizationMembershipList: mocks.getMembershipList },
    });
    mocks.getMembershipList.mockResolvedValue(found("Rina"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first name and asks Clerk only about this org and this user", async () => {
    await expect(getOrgMemberFirstName("org_1", "user_rina")).resolves.toBe(
      "Rina",
    );

    expect(mocks.getMembershipList).toHaveBeenCalledWith({
      organizationId: "org_1",
      userId: ["user_rina"],
      limit: 1,
    });
  });

  it("trims the name", async () => {
    mocks.getMembershipList.mockResolvedValue(found("  Rina  "));

    await expect(getOrgMemberFirstName("org_1", "user_rina")).resolves.toBe(
      "Rina",
    );
  });

  it("returns null for someone who is not a member of the org", async () => {
    mocks.getMembershipList.mockResolvedValue({ data: [] });

    await expect(
      getOrgMemberFirstName("org_1", "user_stranger"),
    ).resolves.toBeNull();
  });

  it("returns null when the member has no first name", async () => {
    mocks.getMembershipList.mockResolvedValue(found(null));
    await expect(getOrgMemberFirstName("org_1", "user_a")).resolves.toBeNull();

    mocks.getMembershipList.mockResolvedValue(found("   "));
    await expect(getOrgMemberFirstName("org_1", "user_b")).resolves.toBeNull();
  });

  it("reuses the answer until the cache expires", async () => {
    await getOrgMemberFirstName("org_1", "user_rina");
    await getOrgMemberFirstName("org_1", "user_rina");
    expect(mocks.getMembershipList).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + NAME_TTL_MS + 1);
    await getOrgMemberFirstName("org_1", "user_rina");
    expect(mocks.getMembershipList).toHaveBeenCalledTimes(2);
  });

  it("never reuses an answer across organizations", async () => {
    await getOrgMemberFirstName("org_1", "user_rina");
    await getOrgMemberFirstName("org_2", "user_rina");

    expect(mocks.getMembershipList).toHaveBeenCalledTimes(2);
  });

  it("returns null and reports to Sentry when Clerk fails", async () => {
    mocks.getMembershipList.mockRejectedValue(new Error("clerk down"));

    await expect(
      getOrgMemberFirstName("org_1", "user_rina"),
    ).resolves.toBeNull();
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });

  it("does not ask Clerk or report again during the failure cooldown, then recovers", async () => {
    mocks.getMembershipList.mockRejectedValueOnce(new Error("clerk down"));
    await getOrgMemberFirstName("org_1", "user_rina");

    await getOrgMemberFirstName("org_1", "user_rina");
    expect(mocks.getMembershipList).toHaveBeenCalledTimes(1);
    expect(mocks.captureException).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + FAILURE_COOLDOWN_MS + 1);
    await expect(getOrgMemberFirstName("org_1", "user_rina")).resolves.toBe(
      "Rina",
    );
    expect(mocks.getMembershipList).toHaveBeenCalledTimes(2);
  });
});
