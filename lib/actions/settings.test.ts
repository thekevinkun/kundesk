// Tests the timezone Server Actions: which zones auto-detect trusts, the once-only
// guard, cache invalidation, and the manual picker. DB, auth and Redis are mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrgAdmin: vi.fn(),
  invalidateOrgCache: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));

// Everything settings.ts imports must be mocked so no real env/DB/Clerk is touched
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { appUrl: "http://localhost:3000" } }));
vi.mock("@/lib/email", () => ({ sendOrgDeletionEmail: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireOrg: vi.fn(),
  requireOrgAdmin: mocks.requireOrgAdmin,
}));
vi.mock("@/lib/redis", () => ({
  invalidateOrgCache: mocks.invalidateOrgCache,
}));
vi.mock("@/lib/db", () => ({ db: { update: mocks.update } }));

import { autoDetectTimezone, updateOrgTimezone } from "./settings";

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
});
