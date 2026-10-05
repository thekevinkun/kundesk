// Tests for the past-due cron — day 3 warning email, day 7 real downgrade
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { PLAN_PRICE } from "@/types/billing";
import { sendPastDueEmail } from "@/lib/email";
import { downgradeToFree } from "@/lib/db/queries/billing";
import { GET } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({
  cronSecret: "test-cron-secret",
  logoUrl: "https://example.com/logo.png",
}));
const mockDb = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));
const insertValues = vi.hoisted(() => vi.fn());
const onConflictDoNothing = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/email", () => ({ sendPastDueEmail: vi.fn() }));
vi.mock("@/lib/db/queries/billing", () => ({ downgradeToFree: vi.fn() }));

const mockSendEmail = vi.mocked(sendPastDueEmail);
const mockDowngrade = vi.mocked(downgradeToFree);

// Fixed "now" so day counting is deterministic
const NOW = new Date("2026-10-05T02:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

type PastDueOrg = {
  id: string;
  name: string;
  plan: string;
  ownerEmail: string | null;
  nextBillingDate: Date | null;
};

// An org whose nextBillingDate is `days` days (plus optional ms) before NOW
function orgOverdue(
  days: number,
  overrides: Partial<PastDueOrg> = {},
  extraMs = 0,
): PastDueOrg {
  return {
    id: "org_a",
    name: "Warung A",
    plan: "starter",
    ownerEmail: "owner@example.com",
    nextBillingDate: new Date(NOW.getTime() - days * DAY_MS - extraMs),
    ...overrides,
  };
}

// Queue one result per db.select() call, in the order the route makes them —
// that order is part of the test's contract (rule 267c)
function mockSelectSequence(
  results: Array<Array<Record<string, unknown>>>,
): void {
  for (const rows of results) {
    mockDb.select.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(rows) }),
    });
  }
}

function makeReq(secret?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/past-due", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

type RouteBody = {
  processed: number;
  results: Array<{ orgId: string; status: string }>;
};

describe("GET /api/cron/past-due", () => {
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
    // Insert chain: both `await values()` and `values().onConflictDoNothing()` work
    onConflictDoNothing.mockResolvedValue(undefined);
    insertValues.mockImplementation(() =>
      Object.assign(Promise.resolve(), { onConflictDoNothing }),
    );
    mockDb.insert.mockReturnValue({ values: insertValues });
    // Happy defaults
    mockSendEmail.mockResolvedValue(undefined);
    mockDowngrade.mockResolvedValue(true);
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

  it("returns processed 0 when no org is past_due", async () => {
    mockSelectSequence([[]]);
    const res = await GET(makeReq(mockEnv.cronSecret));
    const body = (await res.json()) as RouteBody;
    expect(body.processed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDowngrade).not.toHaveBeenCalled();
  });

  it("skips an org with no nextBillingDate", async () => {
    mockSelectSequence([[orgOverdue(5, { nextBillingDate: null })]]);
    const body = (await (
      await GET(makeReq(mockEnv.cronSecret))
    ).json()) as RouteBody;
    expect(body.results).toEqual([{ orgId: "org_a", status: "skipped" }]);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDowngrade).not.toHaveBeenCalled();
  });

  describe("grace period (day 0–2)", () => {
    it("takes no action at 1 day overdue", async () => {
      mockSelectSequence([[orgOverdue(1)]]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results[0]?.status).toBe("skipped");
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockDowngrade).not.toHaveBeenCalled();
    });

    it("takes no action just under 3 days overdue", async () => {
      // 3 days minus 1 ms floors to 2
      mockSelectSequence([[orgOverdue(3, {}, -1)]]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results[0]?.status).toBe("skipped");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("day 3 warning (3 ≤ days < 7)", () => {
    it("sends the warning with the right arguments and records the marker", async () => {
      const org = orgOverdue(3);
      // 2nd select = the "already warned?" lookup → none
      mockSelectSequence([[org], []]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;

      expect(body.results).toEqual([{ orgId: "org_a", status: "warned" }]);
      // Downgrade date = nextBillingDate + 7 days (the day the downgrade really happens)
      const expectedDowngradeDate = new Date(
        (org.nextBillingDate as Date).getTime() + 7 * DAY_MS,
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "Warung A",
        PLAN_PRICE.starter,
        expectedDowngradeDate,
        mockEnv.logoUrl,
      );
      // Marker key is unique per org per billing cycle
      expect(insertValues).toHaveBeenCalledWith({
        externalId: "PASTDUE-org_a-2026-10-02",
        source: "midtrans",
      });
      expect(mockDowngrade).not.toHaveBeenCalled();
    });

    it("sends the email BEFORE recording the marker (rule 167)", async () => {
      mockSelectSequence([[orgOverdue(4)], []]);
      await GET(makeReq(mockEnv.cronSecret));
      const emailOrder = mockSendEmail.mock.invocationCallOrder[0];
      const insertOrder = insertValues.mock.invocationCallOrder[0];
      expect(emailOrder).toBeDefined();
      expect(insertOrder).toBeDefined();
      expect(emailOrder as number).toBeLessThan(insertOrder as number);
    });

    it("warns at the last moment before the downgrade (7 days minus 1 ms)", async () => {
      mockSelectSequence([[orgOverdue(7, {}, -1)], []]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results[0]?.status).toBe("warned");
      expect(mockDowngrade).not.toHaveBeenCalled();
    });

    it("does not warn twice in the same billing cycle", async () => {
      // "already warned?" lookup finds the marker
      mockSelectSequence([[orgOverdue(4)], [{ id: 1 }]]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results[0]?.status).toBe("skipped");
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(insertValues).not.toHaveBeenCalled();
    });

    it("skips an org with no ownerEmail", async () => {
      mockSelectSequence([[orgOverdue(4, { ownerEmail: null })], []]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results[0]?.status).toBe("skipped");
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(insertValues).not.toHaveBeenCalled();
    });

    it("records NO marker when the email send fails, so tomorrow retries", async () => {
      mockSelectSequence([[orgOverdue(4)], []]);
      mockSendEmail.mockRejectedValueOnce(new Error("resend down"));
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results[0]?.status).toBe("failed");
      expect(insertValues).not.toHaveBeenCalled();
    });
  });

  describe("day 7 downgrade (days ≥ 7)", () => {
    it("downgrades at exactly 7 days and sends no email", async () => {
      mockSelectSequence([[orgOverdue(7)]]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results).toEqual([{ orgId: "org_a", status: "downgraded" }]);
      expect(mockDowngrade).toHaveBeenCalledWith("org_a");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("downgrades an org that is far overdue", async () => {
      mockSelectSequence([[orgOverdue(40)]]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results[0]?.status).toBe("downgraded");
    });

    it("reports skipped, not downgraded, when the org paid concurrently", async () => {
      // downgradeToFree returns false when the org is no longer past_due
      mockDowngrade.mockResolvedValueOnce(false);
      mockSelectSequence([[orgOverdue(8)]]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results[0]?.status).toBe("skipped");
    });
  });

  describe("batch behaviour", () => {
    it("one failing org does not stop the others", async () => {
      mockDowngrade
        .mockRejectedValueOnce(new Error("neon timeout"))
        .mockResolvedValueOnce(true);
      mockSelectSequence([
        [orgOverdue(8, { id: "org_a" }), orgOverdue(9, { id: "org_b" })],
      ]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.processed).toBe(2);
      expect(body.results).toEqual([
        { orgId: "org_a", status: "failed" },
        { orgId: "org_b", status: "downgraded" },
      ]);
    });

    it("handles a mix of warned, downgraded and grace-period orgs in one run", async () => {
      mockSelectSequence([
        [
          orgOverdue(1, { id: "org_grace" }),
          orgOverdue(4, { id: "org_warn" }),
          orgOverdue(7, { id: "org_down" }),
        ],
        // Only org_warn reaches the "already warned?" lookup
        [],
      ]);
      const body = (await (
        await GET(makeReq(mockEnv.cronSecret))
      ).json()) as RouteBody;
      expect(body.results).toEqual([
        { orgId: "org_grace", status: "skipped" },
        { orgId: "org_warn", status: "warned" },
        { orgId: "org_down", status: "downgraded" },
      ]);
    });
  });
});
