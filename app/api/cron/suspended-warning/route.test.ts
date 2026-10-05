// Tests for the suspended-warning cron.
// NOTE: since rule 144 no org can become "suspended", so this cron finds nothing in practice
// (rule 146). These tests pin the code while it is still deployed — delete this file together
// with the route if the cron is removed in the dead-code cleanup.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { sendSuspendedWarningEmail } from "@/lib/email";
import { GET } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({
  cronSecret: "test-cron-secret",
  logoUrl: "https://example.com/logo.png",
}));
const mockDb = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn() }));
const updateSet = vi.hoisted(() => vi.fn());
const updateWhere = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/email", () => ({ sendSuspendedWarningEmail: vi.fn() }));

const mockSendEmail = vi.mocked(sendSuspendedWarningEmail);

// Fixed "now" so the deletionRequestedAt stamp and purge date are deterministic
const NOW = new Date("2026-10-05T21:00:00.000Z");

// Same arithmetic as the route (setDate +30), so the test is correct in any machine timezone
function purgeDateFromNow(): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + 30);
  return d;
}

type StaleOrg = {
  id: string;
  name: string;
  ownerEmail: string | null;
  suspendedAt: Date;
};

function staleOrg(overrides: Partial<StaleOrg> = {}): StaleOrg {
  return {
    id: "org_a",
    name: "Warung A",
    ownerEmail: "owner@example.com",
    suspendedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

// The route makes a single select: the stale suspended orgs
function mockStaleOrgs(rows: StaleOrg[]): void {
  mockDb.select.mockReturnValueOnce({
    from: () => ({ where: () => Promise.resolve(rows) }),
  });
}

function makeReq(secret?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/suspended-warning", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

async function run(): Promise<{ processed: number }> {
  const res = await GET(makeReq(mockEnv.cronSecret));
  return (await res.json()) as { processed: number };
}

describe("GET /api/cron/suspended-warning", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    // Only fake Date — real timers keep promises flowing
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    // Silence route logging
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // `db.update(orgs).set({...}).where(...)` is awaited
    updateWhere.mockResolvedValue(undefined);
    updateSet.mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set: updateSet });
    mockSendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("returns processed 0 and does nothing when no org qualifies", async () => {
    mockStaleOrgs([]);
    const body = await run();
    expect(body.processed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  describe("warning flow", () => {
    it("emails the owner with a purge date 30 days out, then starts the deletion clock", async () => {
      mockStaleOrgs([staleOrg()]);
      const body = await run();

      expect(body.processed).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "Warung A",
        purgeDateFromNow(),
        mockEnv.logoUrl,
      );
      expect(updateSet).toHaveBeenCalledWith({ deletionRequestedAt: NOW });
    });

    it("sends the email BEFORE starting the clock", async () => {
      mockStaleOrgs([staleOrg()]);
      await run();
      const emailOrder = mockSendEmail.mock.invocationCallOrder[0] as number;
      const updateOrder = updateSet.mock.invocationCallOrder[0] as number;
      expect(emailOrder).toBeLessThan(updateOrder);
    });

    it("skips an org with no ownerEmail: no email, clock not started, not counted", async () => {
      mockStaleOrgs([staleOrg({ ownerEmail: null })]);
      const body = await run();
      expect(body.processed).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    it("does NOT start the clock when the email fails, so tomorrow retries", async () => {
      mockStaleOrgs([staleOrg()]);
      mockSendEmail.mockRejectedValueOnce(new Error("resend down"));
      const body = await run();
      expect(body.processed).toBe(0);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    // CHARACTERIZATION — the email already went out but the clock did not start, so the
    // next run sends a second warning. Dead code today (rule 146), noted for completeness.
    it("when the DB update fails after the email: not counted, error logged", async () => {
      mockStaleOrgs([staleOrg()]);
      updateWhere.mockRejectedValueOnce(new Error("neon timeout"));
      const body = await run();
      expect(body.processed).toBe(0);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("batch behaviour", () => {
    it("one failing org does not stop the next", async () => {
      mockStaleOrgs([
        staleOrg({ id: "org_a" }),
        staleOrg({
          id: "org_b",
          name: "Warung B",
          ownerEmail: "b@example.com",
        }),
      ]);
      mockSendEmail
        .mockRejectedValueOnce(new Error("resend down"))
        .mockResolvedValueOnce(undefined);
      const body = await run();
      expect(body.processed).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(mockSendEmail).toHaveBeenLastCalledWith(
        "b@example.com",
        "Warung B",
        purgeDateFromNow(),
        mockEnv.logoUrl,
      );
    });

    it("an org with no email does not stop the next", async () => {
      mockStaleOrgs([
        staleOrg({ id: "org_a", ownerEmail: null }),
        staleOrg({ id: "org_b" }),
      ]);
      const body = await run();
      expect(body.processed).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });
});
