// Tests for the monthly reset-usage cron — zeroes messagesUsed and notifies active orgs
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createNotification } from "@/lib/db/queries/dashboard";
import { GET } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({ cronSecret: "test-cron-secret" }));
const mockDb = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn() }));
const updateSet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/db/queries/dashboard", () => ({ createNotification: vi.fn() }));

const mockNotify = vi.mocked(createNotification);

// First select in the route: the count query — `.from(orgs)` is awaited directly
function mockCountRows(rows: Array<{ total: number }>): void {
  mockDb.select.mockReturnValueOnce({ from: () => Promise.resolve(rows) });
}

// Second select in the route: the non-cancelled org ids — `.from().where()`
function mockActiveOrgs(ids: string[]): void {
  mockDb.select.mockReturnValueOnce({
    from: () => ({
      where: () => Promise.resolve(ids.map((id) => ({ id }))),
    }),
  });
}

function makeReq(secret?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/reset-usage", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

type RouteBody = { message?: string; reset?: number; error?: string };

async function run(): Promise<{ status: number; body: RouteBody }> {
  const res = await GET(makeReq(mockEnv.cronSecret));
  return { status: res.status, body: (await res.json()) as RouteBody };
}

describe("GET /api/cron/reset-usage", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    // Silence route logging; keep handles for assertions
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // `db.update(orgs).set({...})` is awaited directly (no where — resets every org)
    updateSet.mockResolvedValue(undefined);
    mockDb.update.mockReturnValue({ set: updateSet });
    // The route calls `.catch()` on the result, so the default must be a real promise
    mockNotify.mockResolvedValue(undefined);
  });

  describe("auth", () => {
    it("rejects a missing authorization header with 401", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(401);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("rejects a wrong secret with 401", async () => {
      const res = await GET(makeReq("wrong-secret"));
      expect(res.status).toBe(401);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe("no orgs", () => {
    it("returns reset 0 and updates nothing when the table is empty", async () => {
      mockCountRows([{ total: 0 }]);
      const { body } = await run();
      expect(body.reset).toBe(0);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("treats an empty count result like zero", async () => {
      mockCountRows([]);
      const { body } = await run();
      expect(body.reset).toBe(0);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    it("resets messagesUsed to 0 and notifies every non-cancelled org", async () => {
      mockCountRows([{ total: 2 }]);
      mockActiveOrgs(["org_a", "org_b"]);
      const { status, body } = await run();

      expect(status).toBe(200);
      expect(body.reset).toBe(2);
      expect(updateSet).toHaveBeenCalledWith({ messagesUsed: 0 });
      expect(mockNotify).toHaveBeenCalledTimes(2);
      expect(mockNotify).toHaveBeenCalledWith(
        "org_a",
        "quota_reset",
        "Kuota pesan direset",
        "Kuota bulan baru siap digunakan",
      );
      expect(mockNotify).toHaveBeenCalledWith(
        "org_b",
        "quota_reset",
        "Kuota pesan direset",
        "Kuota bulan baru siap digunakan",
      );
    });

    it("resets the bulk update BEFORE sending any notification", async () => {
      mockCountRows([{ total: 1 }]);
      mockActiveOrgs(["org_a"]);
      await run();
      const updateOrder = updateSet.mock.invocationCallOrder[0] as number;
      const notifyOrder = mockNotify.mock.invocationCallOrder[0] as number;
      expect(updateOrder).toBeLessThan(notifyOrder);
    });

    // CHARACTERIZATION — `reset` counts every org (cancelled included, they ARE reset),
    // but only non-cancelled orgs get a notification
    it("reports the total org count, not the notified count", async () => {
      mockCountRows([{ total: 3 }]);
      mockActiveOrgs(["org_a", "org_b"]);
      const { body } = await run();
      expect(body.reset).toBe(3);
      expect(mockNotify).toHaveBeenCalledTimes(2);
    });

    it("still resets when every org is cancelled, and sends no notifications", async () => {
      mockCountRows([{ total: 2 }]);
      mockActiveOrgs([]);
      const { body } = await run();
      expect(body.reset).toBe(2);
      expect(updateSet).toHaveBeenCalledWith({ messagesUsed: 0 });
      expect(mockNotify).not.toHaveBeenCalled();
    });
  });

  describe("notification failures", () => {
    it("one failed notification does not fail the run or block the others", async () => {
      const boom = new Error("pusher down");
      mockNotify.mockRejectedValueOnce(boom).mockResolvedValue(undefined);
      mockCountRows([{ total: 2 }]);
      mockActiveOrgs(["org_a", "org_b"]);
      const { status, body } = await run();

      expect(status).toBe(200);
      expect(body.reset).toBe(2);
      expect(mockNotify).toHaveBeenCalledTimes(2);
      // The failure is logged via .catch(console.error)
      expect(console.error).toHaveBeenCalledWith(boom);
    });
  });

  describe("failures", () => {
    it("returns 500 when the count query fails, and updates nothing", async () => {
      mockDb.select.mockReturnValueOnce({
        from: () => Promise.reject(new Error("neon timeout")),
      });
      const { status, body } = await run();
      expect(status).toBe(500);
      expect(body.error).toBe("Internal server error");
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    // CHARACTERIZATION — nobody is told "quota reset" for a reset that never happened
    it("returns 500 and sends NO notification when the bulk update fails", async () => {
      mockCountRows([{ total: 1 }]);
      mockActiveOrgs(["org_a"]);
      updateSet.mockRejectedValueOnce(new Error("neon timeout"));
      const { status } = await run();
      expect(status).toBe(500);
      expect(mockNotify).not.toHaveBeenCalled();
    });
  });
});
