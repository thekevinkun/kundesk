// Tests the timezone Server Actions: which zones auto-detect trusts, the once-only
// guard, cache invalidation, and the manual picker. DB, auth and Redis are mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrgAdmin: vi.fn(),
  invalidateOrgCache: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  // Slug-uniqueness lookup: db.select().from().where().limit()
  select: vi.fn(),
  from: vi.fn(),
  selectWhere: vi.fn(),
  limit: vi.fn(),
  // Clerk name sync: (await clerkClient()).organizations.updateOrganization()
  clerkClient: vi.fn(),
  updateOrganization: vi.fn(),
}));

// Everything settings.ts imports must be mocked so no real env/DB/Clerk is touched
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: mocks.clerkClient }));
vi.mock("@/lib/env", () => ({ env: { appUrl: "http://localhost:3000" } }));
vi.mock("@/lib/email", () => ({ sendOrgDeletionEmail: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireOrg: vi.fn(),
  requireOrgAdmin: mocks.requireOrgAdmin,
}));
vi.mock("@/lib/redis", () => ({
  invalidateOrgCache: mocks.invalidateOrgCache,
}));
vi.mock("@/lib/db", () => ({
  db: { update: mocks.update, select: mocks.select },
}));

import {
  autoDetectTimezone,
  updateOrgProfile,
  updateOrgTimezone,
} from "./settings";

describe("timezone Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrgAdmin.mockResolvedValue({ userId: "u1", orgId: "org_1" });
    mocks.invalidateOrgCache.mockResolvedValue(undefined);
    // db.update(...).set(...).where(...).returning(...) — rebuilt for every test
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ returning: mocks.returning });
    mocks.returning.mockResolvedValue([{ id: "org_1" }]);
    // Slug lookup: by default nobody else owns the slug
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.selectWhere });
    mocks.selectWhere.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockResolvedValue([]);
    // Clerk name sync succeeds by default
    mocks.updateOrganization.mockResolvedValue(undefined);
    mocks.clerkClient.mockResolvedValue({
      organizations: { updateOrganization: mocks.updateOrganization },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("autoDetectTimezone", () => {
    it("ignores a non-Indonesian zone without touching the DB", async () => {
      const result = await autoDetectTimezone("UTC");
      expect(result).toEqual({ success: true, data: { updated: false } });
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("ignores non-string input", async () => {
      const result = await autoDetectTimezone(123);
      expect(result).toEqual({ success: true, data: { updated: false } });
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("updates and invalidates the org cache for an Indonesian zone", async () => {
      const result = await autoDetectTimezone("Asia/Makassar");
      expect(result).toEqual({ success: true, data: { updated: true } });
      expect(mocks.set).toHaveBeenCalledWith(
        expect.objectContaining({ timezoneDetectedAt: expect.any(Date) }),
      );
      expect(mocks.invalidateOrgCache).toHaveBeenCalledWith("org_1");
    });

    it("does nothing when the org was already detected", async () => {
      // The isNull guard matched no row
      mocks.returning.mockResolvedValue([]);
      const result = await autoDetectTimezone("Asia/Makassar");
      expect(result).toEqual({ success: true, data: { updated: false } });
      expect(mocks.invalidateOrgCache).not.toHaveBeenCalled();
    });

    it("still succeeds when cache invalidation fails", async () => {
      mocks.invalidateOrgCache.mockRejectedValue(new Error("redis down"));
      const result = await autoDetectTimezone("Asia/Jayapura");
      expect(result).toEqual({ success: true, data: { updated: true } });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });

    it("rejects non-admins before doing anything", async () => {
      mocks.requireOrgAdmin.mockRejectedValue(new Error("Hanya admin"));
      await expect(autoDetectTimezone("Asia/Makassar")).rejects.toThrow();
      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  describe("updateOrgTimezone", () => {
    it("rejects an invalid zone without touching the DB", async () => {
      const result = await updateOrgTimezone("Not/AZone");
      expect(result).toEqual({
        success: false,
        error: "Zona waktu tidak valid",
      });
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("accepts any valid IANA zone and stamps the detection marker", async () => {
      const result = await updateOrgTimezone("America/New_York");
      expect(result).toEqual({
        success: true,
        data: { timezone: "America/New_York" },
      });
      expect(mocks.set).toHaveBeenCalledWith({
        timezone: "America/New_York",
        timezoneDetectedAt: expect.any(Date),
      });
      expect(mocks.invalidateOrgCache).toHaveBeenCalledWith("org_1");
    });
  });

  describe("updateOrgProfile", () => {
    const validInput = { name: "Warung Paco", slug: "warung-paco-chat" };

    it("saves name and slug, clears the org cache, syncs the name to Clerk and revalidates", async () => {
      const result = await updateOrgProfile(validInput);

      expect(result).toEqual({
        success: true,
        data: { slug: "warung-paco-chat" },
      });
      expect(mocks.set).toHaveBeenCalledWith({
        name: "Warung Paco",
        slug: "warung-paco-chat",
      });
      expect(mocks.invalidateOrgCache).toHaveBeenCalledWith("org_1");
      expect(mocks.updateOrganization).toHaveBeenCalledWith("org_1", {
        name: "Warung Paco",
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });

    it("runs in the safe order: DB write → cache invalidation → Clerk sync", async () => {
      await updateOrgProfile(validInput);

      const order = [
        mocks.set.mock.invocationCallOrder[0],
        mocks.invalidateOrgCache.mock.invocationCallOrder[0],
        mocks.updateOrganization.mock.invocationCallOrder[0],
      ] as number[];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("accepts the org's own current slug (a no-op slug change)", async () => {
      mocks.limit.mockResolvedValue([{ id: "org_1" }]);

      const result = await updateOrgProfile(validInput);

      expect(result.success).toBe(true);
      expect(mocks.invalidateOrgCache).toHaveBeenCalledWith("org_1");
    });

    it.each([
      ["a one-character name", { name: "A", slug: "warung-paco-chat" }],
      ["an uppercase slug", { name: "Warung Paco", slug: "Warung-Paco" }],
      ["a slug with spaces", { name: "Warung Paco", slug: "warung paco" }],
      ["a slug under 3 characters", { name: "Warung Paco", slug: "ab" }],
    ])(
      "rejects %s without touching DB, cache or Clerk",
      async (_label, input) => {
        const result = await updateOrgProfile(input);

        expect(result.success).toBe(false);
        expect(mocks.select).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.invalidateOrgCache).not.toHaveBeenCalled();
        expect(mocks.updateOrganization).not.toHaveBeenCalled();
      },
    );

    it("rejects a slug already used by another org: no write, no cache clear, no Clerk call", async () => {
      mocks.limit.mockResolvedValue([{ id: "org_other" }]);

      const result = await updateOrgProfile(validInput);

      expect(result).toEqual({
        success: false,
        error: "Slug ini sudah digunakan oleh bisnis lain",
      });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.invalidateOrgCache).not.toHaveBeenCalled();
      expect(mocks.updateOrganization).not.toHaveBeenCalled();
    });

    it("turns a unique-constraint race (23505) into the same error, with no cache clear or Clerk call", async () => {
      mocks.where.mockRejectedValueOnce(
        Object.assign(new Error("duplicate key"), { code: "23505" }),
      );

      const result = await updateOrgProfile(validInput);

      expect(result).toEqual({
        success: false,
        error: "Slug ini sudah digunakan oleh bisnis lain",
      });
      expect(mocks.invalidateOrgCache).not.toHaveBeenCalled();
      expect(mocks.updateOrganization).not.toHaveBeenCalled();
    });

    it("rethrows any other DB error, with no cache clear or Clerk call", async () => {
      mocks.where.mockRejectedValueOnce(new Error("neon timeout"));

      await expect(updateOrgProfile(validInput)).rejects.toThrow(
        "neon timeout",
      );
      expect(mocks.invalidateOrgCache).not.toHaveBeenCalled();
      expect(mocks.updateOrganization).not.toHaveBeenCalled();
    });

    it("still saves and syncs Clerk when cache invalidation fails", async () => {
      mocks.invalidateOrgCache.mockRejectedValueOnce(new Error("redis down"));

      const result = await updateOrgProfile(validInput);

      expect(result.success).toBe(true);
      expect(mocks.updateOrganization).toHaveBeenCalledTimes(1);
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });

    // CHARACTERIZATION — a Clerk failure after the committed DB write is not caught: the
    // action throws. The cache was already cleared BEFORE the Clerk call, which is why that
    // order matters: a Clerk outage cannot leave the old slug cached.
    it("when the Clerk sync throws, the action throws but the cache was already cleared", async () => {
      mocks.updateOrganization.mockRejectedValueOnce(new Error("clerk down"));

      await expect(updateOrgProfile(validInput)).rejects.toThrow("clerk down");
      expect(mocks.invalidateOrgCache).toHaveBeenCalledWith("org_1");
    });

    it("rejects non-admins before doing anything", async () => {
      mocks.requireOrgAdmin.mockRejectedValue(new Error("Hanya admin"));

      await expect(updateOrgProfile(validInput)).rejects.toThrow("Hanya admin");
      expect(mocks.select).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.invalidateOrgCache).not.toHaveBeenCalled();
    });
  });
});
