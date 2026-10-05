// Tests for the renewal cron — creates the Midtrans charge, records state, emails the owner
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { PLAN_PRICE, type PlanName } from "@/types/billing";
import { createSubscriptionTransaction } from "@/lib/midtrans";
import { sendBillingReminderEmail } from "@/lib/email";
import {
  getOrgsDueForRenewal,
  markPastDue,
  insertPendingPayment,
} from "@/lib/db/queries/billing";
import { GET } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({
  cronSecret: "test-cron-secret",
  logoUrl: "https://example.com/logo.png",
}));
const mockDb = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));
const insertValues = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/midtrans", () => ({ createSubscriptionTransaction: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendBillingReminderEmail: vi.fn() }));
vi.mock("@/lib/db/queries/billing", () => ({
  getOrgsDueForRenewal: vi.fn(),
  markPastDue: vi.fn(),
  insertPendingPayment: vi.fn(),
}));

const mockCreateTx = vi.mocked(createSubscriptionTransaction);
const mockSendEmail = vi.mocked(sendBillingReminderEmail);
const mockDue = vi.mocked(getOrgsDueForRenewal);
const mockMarkPastDue = vi.mocked(markPastDue);
const mockInsertPending = vi.mocked(insertPendingPayment);

// Fixed "now" so the RENEWAL-{org}-{date} key is deterministic
const NOW = new Date("2026-10-05T01:00:00.000Z");
const DUE_DATE = new Date("2026-10-05T00:00:00.000Z");

type DueOrg = Awaited<ReturnType<typeof getOrgsDueForRenewal>>[number];

function dueOrg(overrides: Partial<DueOrg> = {}): DueOrg {
  return {
    id: "org_a",
    name: "Warung A",
    plan: "starter" as PlanName,
    subscriptionStatus: "active",
    nextBillingDate: DUE_DATE,
    ownerEmail: "owner@example.com",
    ...overrides,
  };
}

// Queue one result per db.select() call — the renewal route makes one per org
// (the "already attempted today?" lookup)
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
  return new NextRequest("http://localhost/api/cron/renewal", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

type RouteBody = {
  processed: number;
  results: Array<{ orgId: string; status: string }>;
};

async function run(): Promise<RouteBody> {
  const res = await GET(makeReq(mockEnv.cronSecret));
  return (await res.json()) as RouteBody;
}

describe("GET /api/cron/renewal", () => {
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
    // In renewal, db.insert is only the idempotency marker (insertPendingPayment is mocked)
    insertValues.mockResolvedValue(undefined);
    mockDb.insert.mockReturnValue({ values: insertValues });
    // Happy defaults
    mockCreateTx.mockResolvedValue({
      redirectUrl: "https://snap.example.com/pay",
      orderId: "KUNDESK-org_a000-STARTER-1-0",
    } as Awaited<ReturnType<typeof createSubscriptionTransaction>>);
    mockInsertPending.mockResolvedValue(undefined);
    mockMarkPastDue.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("auth", () => {
    it("rejects a missing authorization header with 401", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(401);
      expect(mockDue).not.toHaveBeenCalled();
    });

    it("rejects a wrong secret with 401", async () => {
      const res = await GET(makeReq("wrong-secret"));
      expect(res.status).toBe(401);
      expect(mockDue).not.toHaveBeenCalled();
    });
  });

  it("returns processed 0 and touches nothing when no org is due", async () => {
    mockDue.mockResolvedValueOnce([]);
    const body = await run();
    expect(body.processed).toBe(0);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockCreateTx).not.toHaveBeenCalled();
  });

  describe("happy path", () => {
    it("charges the regular plan price, records state, marks past_due, emails the owner", async () => {
      mockDue.mockResolvedValueOnce([dueOrg()]);
      mockSelectSequence([[]]);
      const body = await run();

      expect(body.results).toEqual([{ orgId: "org_a", status: "charged" }]);
      // Renewals always charge the regular price — no discounts
      expect(mockCreateTx).toHaveBeenCalledWith(
        "org_a",
        "starter",
        "owner@example.com",
        PLAN_PRICE.starter,
      );
      // Expected amount persisted so the webhook can validate it
      expect(mockInsertPending).toHaveBeenCalledWith(
        "org_a",
        "KUNDESK-org_a000-STARTER-1-0",
        "starter",
        PLAN_PRICE.starter,
        "https://snap.example.com/pay",
      );
      // One attempt per org per day
      expect(insertValues).toHaveBeenCalledWith({
        externalId: "RENEWAL-org_a-2026-10-05",
        source: "midtrans",
      });
      expect(mockMarkPastDue).toHaveBeenCalledWith("org_a");
      expect(mockSendEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "Warung A",
        DUE_DATE,
        PLAN_PRICE.starter,
        "https://snap.example.com/pay",
        mockEnv.logoUrl,
      );
    });

    it("runs the steps in the safe order: charge → pending row → marker → past_due", async () => {
      mockDue.mockResolvedValueOnce([dueOrg()]);
      mockSelectSequence([[]]);
      await run();
      const order = [
        mockCreateTx.mock.invocationCallOrder[0],
        mockInsertPending.mock.invocationCallOrder[0],
        insertValues.mock.invocationCallOrder[0],
        mockMarkPastDue.mock.invocationCallOrder[0],
      ] as number[];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("uses 'now' as the email date when nextBillingDate is null", async () => {
      mockDue.mockResolvedValueOnce([dueOrg({ nextBillingDate: null })]);
      mockSelectSequence([[]]);
      await run();
      expect(mockSendEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "Warung A",
        NOW,
        PLAN_PRICE.starter,
        "https://snap.example.com/pay",
        mockEnv.logoUrl,
      );
    });
  });

  describe("skips and failures", () => {
    it("skips an org already attempted today, without calling Midtrans", async () => {
      mockDue.mockResolvedValueOnce([dueOrg()]);
      mockSelectSequence([[{ id: 1 }]]);
      const body = await run();
      expect(body.results[0]?.status).toBe("skipped");
      expect(mockCreateTx).not.toHaveBeenCalled();
      expect(mockMarkPastDue).not.toHaveBeenCalled();
    });

    it("fails an org with no ownerEmail without calling Midtrans", async () => {
      mockDue.mockResolvedValueOnce([dueOrg({ ownerEmail: null })]);
      mockSelectSequence([[]]);
      const body = await run();
      expect(body.results[0]?.status).toBe("failed");
      expect(mockCreateTx).not.toHaveBeenCalled();
    });

    it("records no marker and does not touch the org when Midtrans fails (same-day retry allowed)", async () => {
      mockDue.mockResolvedValueOnce([dueOrg()]);
      mockSelectSequence([[]]);
      mockCreateTx.mockRejectedValueOnce(new Error("midtrans 500"));
      const body = await run();
      expect(body.results[0]?.status).toBe("failed");
      expect(insertValues).not.toHaveBeenCalled();
      expect(mockMarkPastDue).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("skips (no marker, no past_due, no email) when the org already has a pending payment (23505)", async () => {
      mockDue.mockResolvedValueOnce([dueOrg()]);
      mockSelectSequence([[]]);
      mockInsertPending.mockRejectedValueOnce(
        Object.assign(new Error("duplicate key"), { code: "23505" }),
      );
      const body = await run();
      expect(body.results[0]?.status).toBe("skipped");
      expect(insertValues).not.toHaveBeenCalled();
      expect(mockMarkPastDue).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("fails the org on any other insertPendingPayment error", async () => {
      mockDue.mockResolvedValueOnce([dueOrg()]);
      mockSelectSequence([[]]);
      mockInsertPending.mockRejectedValueOnce(new Error("connection reset"));
      const body = await run();
      expect(body.results[0]?.status).toBe("failed");
      expect(mockMarkPastDue).not.toHaveBeenCalled();
    });

    it("still reports charged when only the reminder email fails", async () => {
      mockDue.mockResolvedValueOnce([dueOrg()]);
      mockSelectSequence([[]]);
      mockSendEmail.mockRejectedValueOnce(new Error("resend down"));
      const body = await run();
      expect(body.results[0]?.status).toBe("charged");
      expect(mockMarkPastDue).toHaveBeenCalledWith("org_a");
    });
  });

  describe("batch behaviour", () => {
    it("one failing org does not stop the others", async () => {
      mockDue.mockResolvedValueOnce([
        dueOrg({ id: "org_a" }),
        dueOrg({ id: "org_b", name: "Warung B" }),
      ]);
      mockSelectSequence([[], []]);
      mockCreateTx.mockRejectedValueOnce(new Error("midtrans 500"));
      const body = await run();
      expect(body.processed).toBe(2);
      expect(body.results).toEqual([
        { orgId: "org_a", status: "failed" },
        { orgId: "org_b", status: "charged" },
      ]);
    });

    it("uses the Pro price for a Pro org", async () => {
      mockDue.mockResolvedValueOnce([dueOrg({ plan: "pro" as PlanName })]);
      mockSelectSequence([[]]);
      await run();
      expect(mockCreateTx).toHaveBeenCalledWith(
        "org_a",
        "pro",
        "owner@example.com",
        PLAN_PRICE.pro,
      );
    });
  });
});
