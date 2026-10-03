// Unit tests for the payment-reconcile cron
// Covers: auth, mock mode, each Midtrans status outcome, fraud handling, per-order
// error isolation, whole-step failures (500), and reconcile-before-sweep ordering.
// Everything external is mocked — no DB, no Midtrans.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { MidtransStatusResult } from "@/types/settlement";

// Mutable env — vi.hoisted so a test can flip paymentMode (rule 163)
const mockEnv = vi.hoisted(() => ({
  cronSecret: "test-cron-secret",
  paymentMode: "midtrans" as string,
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

// Sentry — spies only, so tests can assert what gets reported
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// Database — only db.insert is used by the route (fraud-flag marker)
vi.mock("@/lib/db", () => ({ db: { insert: vi.fn() } }));
vi.mock("@/lib/db/schema", () => ({
  processedWebhooks: { externalId: "externalId", source: "source" },
}));

// The three collaborators the route orchestrates
vi.mock("@/lib/midtrans", () => ({ getMidtransTransactionStatus: vi.fn() }));
vi.mock("@/lib/billing/settle-payment", () => ({ settlePaidOrder: vi.fn() }));
vi.mock("@/lib/db/queries/billing", () => ({
  expireStalePayments: vi.fn(),
  getReconcileCandidates: vi.fn(),
}));

// ── Import after all mocks are registered ──
import { GET } from "./route";
import { db } from "@/lib/db";
import { getMidtransTransactionStatus } from "@/lib/midtrans";
import { settlePaidOrder } from "@/lib/billing/settle-payment";
import {
  expireStalePayments,
  getReconcileCandidates,
} from "@/lib/db/queries/billing";

const SECRET = "test-cron-secret";

// The "found" shape of Midtrans's status result
type FoundStatus = Extract<MidtransStatusResult, { found: true }>;

// A normal paid order as Get Status returns it (verified live in sandbox)
function paid(
  overrides: Partial<Omit<FoundStatus, "found">> = {},
): MidtransStatusResult {
  return {
    found: true,
    statusCode: "200",
    transactionStatus: "settlement",
    fraudStatus: "accept",
    grossAmount: "99000.00",
    paymentType: "qris",
    ...overrides,
  };
}

// Cron request — Authorization header only when a secret is given
function makeRequest(secret?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/payment-reconcile", {
    method: "GET",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

// db.insert(...).values(...).onConflictDoNothing() chain — returns the final spy
function mockInsert(): ReturnType<typeof vi.fn> {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({ onConflictDoNothing }),
  } as unknown as ReturnType<typeof db.insert>);
  return onConflictDoNothing;
}

// One candidate order, as getReconcileCandidates returns it
const CANDIDATE_A = { orderId: "ORDER-A", status: "expired" };
const CANDIDATE_B = { orderId: "ORDER-B", status: "pending" };

describe("GET /api/cron/payment-reconcile", () => {
  beforeEach(() => {
    // Reset call history, then re-set every default (no state leaks between tests)
    vi.clearAllMocks();
    mockEnv.paymentMode = "midtrans";
    vi.mocked(getReconcileCandidates).mockResolvedValue([]);
    vi.mocked(expireStalePayments).mockResolvedValue(0);
    vi.mocked(getMidtransTransactionStatus).mockResolvedValue({
      found: false,
    });
    vi.mocked(settlePaidOrder).mockResolvedValue({ kind: "activated" });
    mockInsert();
  });

  // ── Auth ──

  it("returns 401 when the cron secret is wrong", async () => {
    const res = await GET(makeRequest("wrong-secret"));

    expect(res.status).toBe(401);
    expect(getReconcileCandidates).not.toHaveBeenCalled();
    expect(expireStalePayments).not.toHaveBeenCalled();
  });

  it("returns 401 when the authorization header is missing", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(getReconcileCandidates).not.toHaveBeenCalled();
  });

  // ── Mock mode / batch size ──

  it("skips reconcile in mock mode but still runs the expire sweep", async () => {
    mockEnv.paymentMode = "mock";

    const res = await GET(makeRequest(SECRET));

    expect(res.status).toBe(200);
    expect(getReconcileCandidates).not.toHaveBeenCalled();
    expect(getMidtransTransactionStatus).not.toHaveBeenCalled();
    expect(expireStalePayments).toHaveBeenCalledTimes(1);
  });

  it("asks for at most 10 candidates per run", async () => {
    await GET(makeRequest(SECRET));

    expect(getReconcileCandidates).toHaveBeenCalledWith(10);
  });

  it("reports how many rows the expire sweep closed", async () => {
    vi.mocked(expireStalePayments).mockResolvedValue(3);

    const res = await GET(makeRequest(SECRET));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      checked: 0,
      recovered: 0,
      flagged: 0,
      errors: 0,
      expiredPayments: 3,
    });
  });

  // ── Ordering ──

  it("reconciles BEFORE the expire sweep", async () => {
    await GET(makeRequest(SECRET));

    // The sweep would hide a paid-but-expired order from reconcile if it ran first
    const reconcileOrder = vi.mocked(getReconcileCandidates).mock
      .invocationCallOrder[0]!;
    const sweepOrder =
      vi.mocked(expireStalePayments).mock.invocationCallOrder[0]!;
    expect(reconcileOrder).toBeLessThan(sweepOrder);
  });

  // ── Recovery ──

  it("recovers a paid order whose webhook was lost, with a Sentry warning", async () => {
    vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
    vi.mocked(getMidtransTransactionStatus).mockResolvedValue(paid());

    const res = await GET(makeRequest(SECRET));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      checked: 1,
      recovered: 1,
      flagged: 0,
      errors: 0,
      expiredPayments: 0,
    });
    // Settled through the shared function with Midtrans's own amount and payment type
    expect(settlePaidOrder).toHaveBeenCalledWith({
      orderId: "ORDER-A",
      grossAmount: "99000.00",
      paymentType: "qris",
    });
    // A recovery means a webhook was lost — a human should see it
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "payment-reconcile: recovered a payment whose webhook was lost",
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("also recovers a credit-card capture", async () => {
    vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
    vi.mocked(getMidtransTransactionStatus).mockResolvedValue(
      paid({ transactionStatus: "capture", paymentType: "credit_card" }),
    );

    await GET(makeRequest(SECRET));

    expect(settlePaidOrder).toHaveBeenCalledWith({
      orderId: "ORDER-A",
      grossAmount: "99000.00",
      paymentType: "credit_card",
    });
  });

  // ── Orders that must NOT be settled ──

  it("leaves an order alone when Midtrans has no transaction for it", async () => {
    vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
    // Default mock already returns { found: false }

    const res = await GET(makeRequest(SECRET));

    expect(res.status).toBe(200);
    expect(settlePaidOrder).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ checked: 1, recovered: 0 });
  });

  it.each(["pending", "expire", "cancel", "deny"])(
    "does not settle an order whose Midtrans status is %s",
    async (transactionStatus) => {
      vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
      vi.mocked(getMidtransTransactionStatus).mockResolvedValue(
        paid({ transactionStatus }),
      );

      const res = await GET(makeRequest(SECRET));

      expect(res.status).toBe(200);
      expect(settlePaidOrder).not.toHaveBeenCalled();
      expect(await res.json()).toMatchObject({ recovered: 0, flagged: 0 });
    },
  );

  it("does not settle when status_code is not 200", async () => {
    vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
    vi.mocked(getMidtransTransactionStatus).mockResolvedValue(
      paid({ statusCode: "201" }),
    );

    await GET(makeRequest(SECRET));

    expect(settlePaidOrder).not.toHaveBeenCalled();
  });

  it.each(["challenge", "deny"])(
    "never activates a fraud_status %s order, marks it processed and alerts Sentry",
    async (fraudStatus) => {
      vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
      vi.mocked(getMidtransTransactionStatus).mockResolvedValue(
        paid({ fraudStatus }),
      );
      const onConflictDoNothing = mockInsert();

      const res = await GET(makeRequest(SECRET));

      expect(res.status).toBe(200);
      expect(settlePaidOrder).not.toHaveBeenCalled();
      // Marked processed so the cron stops revisiting it every day
      expect(onConflictDoNothing).toHaveBeenCalled();
      expect(await res.json()).toMatchObject({ flagged: 1, recovered: 0 });
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        "payment-reconcile: fraud flag on a lost order",
        expect.objectContaining({ level: "error" }),
      );
    },
  );

  // ── What settlePaidOrder reports back ──

  it("counts a flagged settlement without a recovery warning", async () => {
    vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
    vi.mocked(getMidtransTransactionStatus).mockResolvedValue(paid());
    vi.mocked(settlePaidOrder).mockResolvedValue({
      kind: "flagged",
      body: { message: "Amount mismatch — flagged for review" },
    });

    const res = await GET(makeRequest(SECRET));

    expect(await res.json()).toMatchObject({ recovered: 0, flagged: 1 });
    expect(Sentry.captureMessage).not.toHaveBeenCalledWith(
      "payment-reconcile: recovered a payment whose webhook was lost",
      expect.anything(),
    );
  });

  it("counts nothing when a concurrent run already finished the order", async () => {
    vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
    vi.mocked(getMidtransTransactionStatus).mockResolvedValue(paid());
    vi.mocked(settlePaidOrder).mockResolvedValue({
      kind: "already_processed",
    });

    const res = await GET(makeRequest(SECRET));

    expect(await res.json()).toMatchObject({
      recovered: 0,
      flagged: 0,
      errors: 0,
    });
  });

  // ── Per-order error isolation ──

  it("skips an order whose status lookup fails and still handles the next one", async () => {
    vi.mocked(getReconcileCandidates).mockResolvedValue([
      CANDIDATE_A,
      CANDIDATE_B,
    ]);
    vi.mocked(getMidtransTransactionStatus).mockImplementation(
      async (orderId) => {
        if (orderId === "ORDER-A") throw new Error("timeout");
        return paid();
      },
    );

    const res = await GET(makeRequest(SECRET));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      checked: 2,
      recovered: 1,
      errors: 1,
    });
    // Only the second order was settled
    expect(settlePaidOrder).toHaveBeenCalledTimes(1);
    expect(settlePaidOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ORDER-B" }),
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({ step: "get-status" }),
      }),
    );
  });

  it("counts an error and keeps going when settling throws", async () => {
    vi.mocked(getReconcileCandidates).mockResolvedValue([CANDIDATE_A]);
    vi.mocked(getMidtransTransactionStatus).mockResolvedValue(paid());
    vi.mocked(settlePaidOrder).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest(SECRET));

    // One bad order is not a failed run — the next run retries it
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ recovered: 0, errors: 1 });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({ step: "settle" }),
      }),
    );
  });

  // ── Whole-step failures answer 500 ──

  it("returns 500 but still runs the sweep when the reconcile step fails", async () => {
    vi.mocked(getReconcileCandidates).mockRejectedValue(new Error("ETIMEDOUT"));

    const res = await GET(makeRequest(SECRET));

    expect(res.status).toBe(500);
    // A reconcile failure must never stop housekeeping
    expect(expireStalePayments).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({ step: "reconcile" }),
      }),
    );
  });

  it("returns 500 when the expire sweep fails", async () => {
    vi.mocked(expireStalePayments).mockRejectedValue(new Error("ETIMEDOUT"));

    const res = await GET(makeRequest(SECRET));

    expect(res.status).toBe(500);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({ step: "expire-sweep" }),
      }),
    );
  });
});
