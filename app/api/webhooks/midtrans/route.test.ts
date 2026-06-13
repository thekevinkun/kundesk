// Unit tests for the Midtrans webhook handler
// Tests every layer of the state machine:
//   signature → idempotency → status → fraud → order_id parsing → activation
// All DB calls and external functions are mocked — no real DB touched

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock @/lib/env ──
// env.ts calls requireEnv() at module load — throws if vars missing in test env
// We replace the entire module with a stable fake object
vi.mock("@/lib/env", () => ({
  env: {
    databaseUrl: "postgresql://placeholder-host/placeholder-db",
    clerkSecretKey: "sk_test_fake",
    clerkWebhookSecret: "whsec_fake",
    appUrl: "http://localhost:3000",
    logoUrl: "http://localhost:3000/logo.png",
    cronSecret: "fake-cron-secret",
    midtransServerKey: "fake-server-key",
    midtransClientKey: "fake-client-key",
    midtransProduction: false,
    paymentMode: "mock",
    aiMode: "mock",
    embeddingMode: "mock",
    storageMode: "mock",
    realtimeMode: "mock",
    emailMode: "mock",
  },
}));

// ── Mock verifyMidtransSignature ──
// Controls whether signature check passes — default true, overridden per test
vi.mock("@/lib/midtrans", () => ({
  verifyMidtransSignature: vi.fn(() => true),
}));

// ── Mock the database ──
// db.select().from().where() returns [] by default (not processed yet)
// db.insert().values() is a no-op
// Each test overrides the select return value as needed
vi.mock("@/lib/db", () => {
  const selectMock = vi.fn();

  // Default select chain
  selectMock.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });

  // Shared insert mock
  const insertMock = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });

  return {
    db: {
      select: selectMock,

      insert: insertMock,

      // Mock transaction wrapper
      transaction: vi.fn(async (callback) => {
        // Fake tx object passed into transaction callback
        const tx = {
          insert: insertMock,

          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };

        return callback(tx);
      }),
    },
  };
});

// ── Mock billing queries ──
// We verify these get called with correct args on the happy path
vi.mock("@/lib/db/queries/billing", () => ({
  activateSubscription: vi
    .fn()
    .mockResolvedValue({ periodEnd: new Date("2026-07-12") }),
  markPaymentSuccess: vi.fn().mockResolvedValue(undefined),
  markPaymentClosed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({
  sendPlanUpgradedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentPendingEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock drizzle operators ──
// The handler imports { and, eq, sql } from drizzle-orm — just return identity
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

// ── Mock schema ──
// Handler imports { processedWebhooks, orgs } — just need the shape
vi.mock("@/lib/db/schema", () => ({
  processedWebhooks: { id: "id", source: "source", externalId: "externalId" },
  orgs: { id: "id", name: "name", ownerEmail: "ownerEmail" },
}));

// ── Import after all mocks are registered ──
import { POST } from "./route";
import { verifyMidtransSignature } from "@/lib/midtrans";
import {
  activateSubscription,
  markPaymentSuccess,
  markPaymentClosed,
} from "@/lib/db/queries/billing";
import { db } from "@/lib/db";

// ── Helper: build a NextRequest with a JSON body ──
function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/midtrans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Helper: valid Midtrans notification payload ──
// order_id format: KUNDESK-{orgIdSlice}-{PLAN}-{timestamp}
// orgIdSlice matches LEFT(orgId, 8) — "org_3DZH" = first 8 chars of a Clerk orgId
function validNotification(overrides: object = {}) {
  return {
    order_id: "KUNDESK-org_3DZH-STARTER-1234567890",
    transaction_status: "settlement",
    fraud_status: "accept",
    gross_amount: "149000",
    payment_type: "bank_transfer",
    transaction_id: "txn_abc123",
    signature_key: "valid-signature",
    status_code: "200",
    ...overrides,
  };
}

describe("POST /api/webhooks/midtrans", () => {
  beforeEach(() => {
    // Reset all mocks between tests — prevents state leaking between cases
    vi.clearAllMocks();

    // Restore default: signature valid, not yet processed, org found
    vi.mocked(verifyMidtransSignature).mockReturnValue(true);

    // Default db.select chain: nothing processed yet
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ReturnType<typeof db.select>);

    // Default db.insert: no-op
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof db.insert>);

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),

        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      return callback(tx as never);
    });
  });

  // ── Layer 1: Signature verification ──

  it("returns 401 when signature is invalid", async () => {
    // Simulate Midtrans sending a tampered notification
    vi.mocked(verifyMidtransSignature).mockReturnValue(false);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  // ── Layer 2: Idempotency ──

  it("returns 200 and skips processing when notification already processed", async () => {
    // Simulate: this order_id already exists in processedWebhooks
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 1 }]), // already processed
      }),
    } as unknown as ReturnType<typeof db.select>);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Already processed");

    // Critical: subscription must NOT be activated on duplicate
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(markPaymentSuccess).not.toHaveBeenCalled();
  });

  // ── Layer 3: Transaction status ──

  it("returns 200 with no action for pending status", async () => {
    const res = await POST(
      makeRequest(validNotification({ transaction_status: "pending" })),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("No action required");
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  it("closes the payment as expired for expire status", async () => {
    const res = await POST(
      makeRequest(validNotification({ transaction_status: "expire" })),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Payment closed");
    expect(markPaymentClosed).toHaveBeenCalledWith(
      "KUNDESK-org_3DZH-STARTER-1234567890",
      "expired",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  it("closes the payment as failed for cancel status", async () => {
    const res = await POST(
      makeRequest(validNotification({ transaction_status: "cancel" })),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Payment closed");
    expect(markPaymentClosed).toHaveBeenCalledWith(
      "KUNDESK-org_3DZH-STARTER-1234567890",
      "failed",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  it("activates subscription for capture status (credit card)", async () => {
    // "capture" is credit card equivalent of "settlement"
    // db.select returns: not processed yet (first call), then org found (second call)
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnValue({
          // First select: idempotency check → not processed
          // Second select: org lookup → found
          where: vi
            .fn()
            .mockResolvedValue(
              callCount === 1
                ? []
                : [
                    {
                      id: "org_3DZHfake123",
                      name: "Test Org",
                      ownerEmail: "owner@test.com",
                    },
                  ],
            ),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    const res = await POST(
      makeRequest(validNotification({ transaction_status: "capture" })),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("OK");
    expect(activateSubscription).toHaveBeenCalled();
  });

  // ── Layer 4: Fraud check ──

  it("does not activate subscription when fraud_status is challenge", async () => {
    const res = await POST(
      makeRequest(validNotification({ fraud_status: "challenge" })),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Flagged for review");

    // Subscription must NOT activate on fraud flag
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(markPaymentSuccess).not.toHaveBeenCalled();

    // But must be marked as processed so Midtrans stops retrying
    expect(db.insert).toHaveBeenCalled();
  });

  it("does not activate subscription when fraud_status is deny", async () => {
    const res = await POST(
      makeRequest(validNotification({ fraud_status: "deny" })),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Flagged for review");
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  // ── Layer 5: order_id parsing ──

  it("returns 400 for malformed order_id with fewer than 4 parts", async () => {
    const res = await POST(
      makeRequest(validNotification({ order_id: "KUNDESK-org_3DZH" })),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Malformed order_id");
  });

  it("returns 400 for unknown plan in order_id", async () => {
    const res = await POST(
      makeRequest(
        validNotification({ order_id: "KUNDESK-org_3DZH-ENTERPRISE-123" }),
      ),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unknown plan");
  });

  // ── Layer 6: Org resolution ──

  it("returns 200 when org not found for the order_id slice", async () => {
    // First select (idempotency): not processed — Second select (org): not found
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            callCount === 1 ? [] : [], // both return empty
          ),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe("Org resolution ambiguous");
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  // ── Layer 7+8: Happy path ──

  it("activates subscription and marks payment as success on valid settlement", async () => {
    // Two db.select calls: idempotency check (empty) then org lookup (found)
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            callCount === 1
              ? []
              : [
                  {
                    id: "org_3DZHfake123",
                    name: "Test Org",
                    ownerEmail: "owner@test.com",
                  },
                ],
          ),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    const notification = validNotification();
    const res = await POST(makeRequest(notification));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("OK");

    // Subscription activated with correct org and plan
    expect(activateSubscription).toHaveBeenCalledWith(
      "org_3DZHfake123",
      "starter",
      "bank_transfer",
    );

    // Pending payment row marked as success
    expect(markPaymentSuccess).toHaveBeenCalledWith(
      notification.order_id,
      "bank_transfer",
    );
  });

  it("activates pro plan when order_id contains PRO", async () => {
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            callCount === 1
              ? []
              : [
                  {
                    id: "org_3DZHfake123",
                    name: "Test Org",
                    ownerEmail: "owner@test.com",
                  },
                ],
          ),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    const res = await POST(
      makeRequest(
        validNotification({
          order_id: "KUNDESK-org_3DZH-PRO-1234567890",
          gross_amount: "399000",
        }),
      ),
    );

    expect(res.status).toBe(200);

    // Plan extracted from order_id correctly
    expect(activateSubscription).toHaveBeenCalledWith(
      "org_3DZHfake123",
      "pro",
      "bank_transfer",
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    // Send a request with a broken body — can't be parsed as JSON
    const req = new NextRequest("http://localhost:3000/api/webhooks/midtrans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "this is not json {{{",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });
});
