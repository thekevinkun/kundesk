// Tests for the retention cron — deletes messages older than 90 days
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { deleteOldMessages } from "@/lib/db/queries/dashboard";
import { GET } from "./route";

// Hoisted so the vi.mock factory below can reference it (rule 163)
const mockEnv = vi.hoisted(() => ({ cronSecret: "test-cron-secret" }));

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db/queries/dashboard", () => ({ deleteOldMessages: vi.fn() }));

const mockDelete = vi.mocked(deleteOldMessages);

function makeReq(secret?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/retention", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/cron/retention", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    // Silence route logging
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockDelete.mockResolvedValue(0);
  });

  describe("auth", () => {
    it("rejects a missing authorization header with 401 and deletes nothing", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(401);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("rejects a wrong secret with 401 and deletes nothing", async () => {
      const res = await GET(makeReq("wrong-secret"));
      expect(res.status).toBe(401);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  it("deletes with a 90-day retention window and reports the count", async () => {
    mockDelete.mockResolvedValueOnce(42);
    const res = await GET(makeReq(mockEnv.cronSecret));
    const body = (await res.json()) as {
      deletedCount: number;
      retentionDays: number;
    };

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(90);
    expect(body.deletedCount).toBe(42);
    expect(body.retentionDays).toBe(90);
  });

  it("succeeds with deletedCount 0 when nothing is old enough", async () => {
    const res = await GET(makeReq(mockEnv.cronSecret));
    const body = (await res.json()) as { deletedCount: number };
    expect(res.status).toBe(200);
    expect(body.deletedCount).toBe(0);
  });

  it("returns 500 when the delete fails, so a broken run is visible", async () => {
    mockDelete.mockRejectedValueOnce(new Error("neon timeout"));
    const res = await GET(makeReq(mockEnv.cronSecret));
    const body = (await res.json()) as { error: string; deletedCount?: number };
    expect(res.status).toBe(500);
    expect(body.error).toBe("Retention job failed");
    expect(body.deletedCount).toBeUndefined();
  });
});
