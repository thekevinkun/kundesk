// Unit tests for the Midtrans webhook handler
// Layers covered: body shape → signature → idempotency → status → fraud → status_code →
// order_id → checkout record → org → amount → transaction → post-commit work
// All DB calls and external functions are mocked — no real DB touched

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Callbacks the route registers through after() — collected so tests can run them by hand
const afterCallbacks = vi.hoisted(
  () => [] as Array<() => Promise<void> | void>,
);

// Mutable env — vi.hoisted so a test can flip paymentMode (rule 163)
const mockEnv = vi.hoisted(() => ({
  databaseUrl: "postgresql://placeholder-host/placeholder-db",
  clerkSecretKey: "sk_test_fake",
  clerkWebhookSecret: "whsec_fake",
  appUrl: "http://localhost:3000",
  logoUrl: "http://localhost:3000/logo.png",
  cronSecret: "fake-cron-secret",
  midtransServerKey: "fake-server-key",
  midtransClientKey: "fake-client-key",
  midtransProduction: false,
  paymentMode: "mock" as string,
  aiMode: "mock",
  embeddingMode: "mock",
  storageMode: "mock",
  realtimeMode: "mock",
  emailMode: "mock",
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

// Real NextRequest/NextResponse, but after() only records its callback
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (callback: () => Promise<void> | void) => {
      afterCallbacks.push(callback);
    },
  };
});

// Sentry — spies only, so tests can assert what gets reported
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// PostHog and the dashboard notification — no real side effects
vi.mock("@/lib/posthog", () => ({
  trackEventImmediate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/db/queries/dashboard", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// Signature check — default true, overridden per test
vi.mock("@/lib/midtrans", () => ({
  verifyMidtransSignature: vi.fn(() => true),
}));

// Database — chains are rebuilt in beforeEach
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Billing queries — real OrgPurgingError class inside the factory (route uses instanceof)
vi.mock("@/lib/db/queries/billing", () => {
  class OrgPurgingError extends Error {
    constructor() {
      super("Organization is already being purged");
      this.name = "OrgPurgingError";
    }
  }

  return {
    OrgPurgingError,
    activateSubscription: vi
      .fn()
      .mockResolvedValue({ periodEnd: new Date("2026-07-12") }),
    markPaymentSuccess: vi.fn().mockResolvedValue(undefined),
    markPaymentClosed: vi.fn().mockResolvedValue(undefined),
    getPaymentByOrderId: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("@/lib/email", () => ({
  sendPlanUpgradedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentPendingEmail: vi.fn().mockResolvedValue(undefined),
}));

// Drizzle operators — identity-style fakes so tests can assert how they were called
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

// Schema — only the shape the handler touches
vi.mock("@/lib/db/schema", () => ({
  processedWebhooks: { id: "id", source: "source", externalId: "externalId" },
  orgs: { id: "id", name: "name", ownerEmail: "ownerEmail" },
  promoCodes: { id: "id", usedCount: "usedCount" },
}));

// ── Import after all mocks are registered ──
import { POST } from "./route";
import { verifyMidtransSignature } from "@/lib/midtrans";
import {
  activateSubscription,
  markPaymentSuccess,
  markPaymentClosed,
  getPaymentByOrderId,
  OrgPurgingError,
} from "@/lib/db/queries/billing";
import { createNotification } from "@/lib/db/queries/dashboard";
import { trackEventImmediate } from "@/lib/posthog";
import { sendPlanUpgradedEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

// ── Fixtures ──
const ORG = {
  id: "org_3DZHfake123",
  name: "Test Org",
  ownerEmail: "owner@test.com",
};

// A checkout row as insertPendingPayment would have written it
const CHECKOUT_ROW = {
  orgId: ORG.id,
  plan: "starter",
  amount: 149000,
  status: "pending",
};

// ── Helpers ──

// Body can be anything — some tests send `null` on purpose
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/midtrans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// order_id format: KUNDESK-{first 8 chars of orgId}-{PLAN}-{timestamp}
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

// One result per db.select() call, in call order: [idempotency, org lookup, ...]
function mockSelectSequence(results: unknown[][]): void {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const result = results[call] ?? [];
    call++;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(result),
      }),
    } as unknown as ReturnType<typeof db.select>;
  });
}

// Idempotency check → not processed, org lookup → found
function mockOrgFound(): void {
  mockSelectSequence([[], [ORG]]);
}

// db.insert chain — both `await values()` and `values().onConflictDoNothing()` work on it
function mockInsert(): { onConflictDoNothing: ReturnType<typeof vi.fn> } {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const valuesResult = Object.assign(Promise.resolve(undefined), {
    onConflictDoNothing,
  });
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue(valuesResult),
  } as unknown as ReturnType<typeof db.insert>);
  return { onConflictDoNothing };
}

// Runs everything the route handed to after() — the email and analytics work
async function runAfterCallbacks(): Promise<void> {
  await Promise.all(afterCallbacks.map((callback) => callback()));
}

describe("POST /api/webhooks/midtrans", () => {
  beforeEach(() => {
    // Reset call history between tests — prevents state leaking between cases
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mockEnv.paymentMode = "mock";

    // Restore defaults: signature valid, nothing processed, no checkout row
    vi.mocked(verifyMidtransSignature).mockReturnValue(true);
    mockSelectSequence([]);
    mockInsert();
    vi.mocked(getPaymentByOrderId).mockResolvedValue(null);

    // Transaction runs its callback with a fake tx handle
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

  // ── Body shape ──

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhooks/midtrans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "this is not json {{{",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON");
  });

  it("returns 400 for a null body without crashing", async () => {
    const res = await POST(makeRequest(null));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid payload");
    expect(verifyMidtransSignature).not.toHaveBeenCalled();
  });

  it("returns 400 when a required field is missing", async () => {
    const body: Record<string, unknown> = validNotification();
    delete body.signature_key;

    const res = await POST(makeRequest(body));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid payload");
  });

  // ── Layer 1: Signature ──

  it("returns 401 when signature is invalid", async () => {
    vi.mocked(verifyMidtransSignature).mockReturnValue(false);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Invalid signature");
  });

  // ── Layer 2: Idempotency ──

  it("returns 200 and skips processing when notification already processed", async () => {
    mockSelectSequence([[{ id: 1 }]]);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Already processed");
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(markPaymentSuccess).not.toHaveBeenCalled();
  });

  // ── Layer 3: Transaction status ──

  it("returns 200 with no action for pending status", async () => {
    const res = await POST(
      makeRequest(validNotification({ transaction_status: "pending" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("No action required");
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  it("closes the payment as expired for expire status", async () => {
    const res = await POST(
      makeRequest(validNotification({ transaction_status: "expire" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Payment closed");
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
    expect((await res.json()).message).toBe("Payment closed");
    expect(markPaymentClosed).toHaveBeenCalledWith(
      "KUNDESK-org_3DZH-STARTER-1234567890",
      "failed",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  it("activates subscription for capture status (credit card)", async () => {
    mockOrgFound();

    const res = await POST(
      makeRequest(validNotification({ transaction_status: "capture" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("OK");
    expect(activateSubscription).toHaveBeenCalled();
  });

  // ── Layer 4: Fraud ──

  it("does not activate subscription when fraud_status is challenge", async () => {
    const res = await POST(
      makeRequest(validNotification({ fraud_status: "challenge" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Flagged for review");
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(markPaymentSuccess).not.toHaveBeenCalled();
    // Marked processed so Midtrans stops retrying
    expect(db.insert).toHaveBeenCalled();
  });

  it("does not activate subscription when fraud_status is deny", async () => {
    const res = await POST(
      makeRequest(validNotification({ fraud_status: "deny" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Flagged for review");
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  it("still flags fraud when a challenged capture arrives with status_code 201", async () => {
    // The status_code check must run AFTER the fraud check — 201 is legitimate here
    const res = await POST(
      makeRequest(
        validNotification({
          transaction_status: "capture",
          fraud_status: "challenge",
          status_code: "201",
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Flagged for review");
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  // ── status_code consistency ──

  it("takes no action when a settlement arrives with status_code other than 200", async () => {
    const res = await POST(
      makeRequest(validNotification({ status_code: "201" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Inconsistent status — no action");
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "midtrans webhook: settlement with unexpected status_code",
      expect.objectContaining({ level: "warning" }),
    );
  });

  // ── order_id parsing (permanent failures answer 200 + Sentry, never 400) ──

  it("answers 200 and alerts Sentry for an order_id with too few parts", async () => {
    const res = await POST(
      makeRequest(validNotification({ order_id: "KUNDESK-org_3DZH" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "Unprocessable order_id — flagged for review",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "midtrans webhook: settled payment with unparseable order_id",
      expect.objectContaining({ level: "error" }),
    );
  });

  it("answers 200 and alerts Sentry for an unknown plan in order_id", async () => {
    const res = await POST(
      makeRequest(
        validNotification({ order_id: "KUNDESK-org_3DZH-ENTERPRISE-123" }),
      ),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "Unprocessable order_id — flagged for review",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalled();
  });

  it("rejects an order_id with trailing junk", async () => {
    const res = await POST(
      makeRequest(
        validNotification({
          order_id: "KUNDESK-org_3DZH-STARTER-1234567890-X",
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "Unprocessable order_id — flagged for review",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  // ── Checkout record ──

  it("refuses a settlement with no checkout record in real mode", async () => {
    mockEnv.paymentMode = "midtrans";

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "No checkout record — flagged for review",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "midtrans webhook: settled payment has no checkout record",
      expect.objectContaining({ level: "error" }),
    );
  });

  it("flags a settlement whose order_id org does not match the checkout record", async () => {
    vi.mocked(getPaymentByOrderId).mockResolvedValue({
      ...CHECKOUT_ROW,
      orgId: "org_ZZZZother99",
    });
    const { onConflictDoNothing } = mockInsert();

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "Order mismatch — flagged for review",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
    // Marked processed so Midtrans stops retrying
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it("flags a settlement whose order_id plan does not match the checkout record", async () => {
    vi.mocked(getPaymentByOrderId).mockResolvedValue({
      ...CHECKOUT_ROW,
      plan: "pro",
    });

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "Order mismatch — flagged for review",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  it("resolves the org by the full orgId on the checkout row, not the 8-char prefix", async () => {
    vi.mocked(getPaymentByOrderId).mockResolvedValue(CHECKOUT_ROW);
    mockOrgFound();

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("id", ORG.id);
    // The prefix lookup builds its filter with sql`` — it must not run
    expect(sql).not.toHaveBeenCalled();
    expect(activateSubscription).toHaveBeenCalled();
  });

  it("answers 200 and alerts Sentry when the checkout row has no org (purged)", async () => {
    vi.mocked(getPaymentByOrderId).mockResolvedValue({
      ...CHECKOUT_ROW,
      orgId: null,
    });

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("Org resolution failed");
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "midtrans webhook: org resolution failed",
      expect.objectContaining({ level: "error" }),
    );
  });

  it("still activates a settlement for a non-pending order, with a Sentry warning", async () => {
    vi.mocked(getPaymentByOrderId).mockResolvedValue({
      ...CHECKOUT_ROW,
      status: "cancelled",
    });
    mockOrgFound();

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    // Real money arrived — activation is not blocked (rule 160)
    expect(activateSubscription).toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "midtrans webhook: settlement for a non-pending order",
      expect.objectContaining({ level: "warning" }),
    );
  });

  // ── Org resolution (mock-mode fallback, no checkout row) ──

  it("answers 200 and alerts Sentry when no org matches the order_id slice", async () => {
    mockSelectSequence([[], []]);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("Org resolution failed");
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "midtrans webhook: org resolution failed",
      expect.objectContaining({ level: "error" }),
    );
  });

  it("refuses to activate when two orgs share the slice", async () => {
    mockSelectSequence([[], [ORG, { ...ORG, id: "org_3DZHother99" }]]);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("Org resolution failed");
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  // ── Happy path ──

  it("activates subscription and marks payment as success on valid settlement", async () => {
    mockOrgFound();

    const notification = validNotification();
    const res = await POST(makeRequest(notification));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("OK");
    // tx handle passed through so activation and payment write roll back together
    expect(activateSubscription).toHaveBeenCalledWith(
      ORG.id,
      "starter",
      "bank_transfer",
      expect.anything(),
    );
    expect(markPaymentSuccess).toHaveBeenCalledWith(
      ORG.id,
      notification.order_id,
      "starter",
      149000,
      "bank_transfer",
      expect.anything(),
    );
  });

  it("activates pro plan when order_id contains PRO", async () => {
    mockOrgFound();

    const res = await POST(
      makeRequest(
        validNotification({
          order_id: "KUNDESK-org_3DZH-PRO-1234567890",
          gross_amount: "399000",
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect(activateSubscription).toHaveBeenCalledWith(
      ORG.id,
      "pro",
      "bank_transfer",
      expect.anything(),
    );
  });

  // ── Amount validation ──

  it("rejects activation when reported amount doesn't match the payment record", async () => {
    mockOrgFound();
    vi.mocked(getPaymentByOrderId).mockResolvedValue(CHECKOUT_ROW);

    const res = await POST(
      makeRequest(validNotification({ gross_amount: "1000" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "Amount mismatch — flagged for review",
    );
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(markPaymentSuccess).not.toHaveBeenCalled();
  });

  it("activates normally when reported amount matches the payment record", async () => {
    mockOrgFound();
    vi.mocked(getPaymentByOrderId).mockResolvedValue(CHECKOUT_ROW);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("OK");
    expect(activateSubscription).toHaveBeenCalled();
  });

  // ── Retry safety ──

  it("ignores a denied attempt without closing the order or marking it processed", async () => {
    const res = await POST(
      makeRequest(validNotification({ transaction_status: "deny" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Attempt denied — no action");
    expect(markPaymentClosed).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("activates the plan when a payment settles after an earlier denied attempt", async () => {
    await POST(makeRequest(validNotification({ transaction_status: "deny" })));
    expect(db.insert).not.toHaveBeenCalled();

    mockOrgFound();
    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect(activateSubscription).toHaveBeenCalled();
  });

  it("does not mark expire notifications as processed", async () => {
    await POST(
      makeRequest(validNotification({ transaction_status: "expire" })),
    );

    expect(markPaymentClosed).toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns 503 when the database fails (so Midtrans retries)", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("ETIMEDOUT")),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(503);
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("returns 503 and does not mark processed when activation fails with a normal error", async () => {
    mockOrgFound();
    vi.mocked(activateSubscription).mockRejectedValueOnce(
      new Error("ETIMEDOUT"),
    );

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(503);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns 200 and marks processed when the org is being purged", async () => {
    mockOrgFound();
    vi.mocked(activateSubscription).mockRejectedValueOnce(
      new OrgPurgingError(),
    );
    const { onConflictDoNothing } = mockInsert();

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "Activation failed — flagged for review",
    );
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it("returns 503 when recording the purge outcome fails", async () => {
    mockOrgFound();
    vi.mocked(activateSubscription).mockRejectedValueOnce(
      new OrgPurgingError(),
    );
    // A real DB failure (not a duplicate) must not be swallowed
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockRejectedValue(new Error("ETIMEDOUT")),
      }),
    } as unknown as ReturnType<typeof db.insert>);

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(503);
  });

  it("returns 200 when a concurrent retry already finished the order", async () => {
    // Selects: idempotency (empty), org, then the re-check after the unique violation (found)
    mockSelectSequence([[], [ORG], [{ id: 1 }]]);
    vi.mocked(db.transaction).mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Already processed");
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("recognises a unique violation wrapped in err.cause (Drizzle style)", async () => {
    mockSelectSequence([[], [ORG], [{ id: 1 }]]);
    vi.mocked(db.transaction).mockRejectedValueOnce(
      new Error("wrapped", { cause: { code: "23505" } }),
    );

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Already processed");
  });

  it("returns 503 on a unique violation when the order was NOT finished elsewhere", async () => {
    // The re-check finds nothing — the violation came from somewhere else, so retry
    mockSelectSequence([[], [ORG], []]);
    vi.mocked(db.transaction).mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(503);
  });

  // ── Post-commit work ──

  it("still returns 200 and reports to Sentry when the dashboard notification fails", async () => {
    mockOrgFound();
    vi.mocked(createNotification).mockRejectedValueOnce(new Error("db down"));

    const res = await POST(makeRequest(validNotification()));

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("OK");
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("sends the upgrade email and tracks the event through after()", async () => {
    mockOrgFound();

    await POST(makeRequest(validNotification()));
    await runAfterCallbacks();

    expect(sendPlanUpgradedEmail).toHaveBeenCalledWith(
      ORG.ownerEmail,
      ORG.name,
      "starter",
      149000,
      "bank_transfer",
      "KUNDESK-org_3DZH-STARTER-1234567890",
      expect.any(Date),
      expect.any(Date),
      "http://localhost:3000/logo.png",
    );
    expect(trackEventImmediate).toHaveBeenCalledWith(
      ORG.id,
      "plan_upgraded",
      expect.objectContaining({ plan: "starter", has_promo: false }),
    );
  });

  it("skips the email when the org has no owner email", async () => {
    mockSelectSequence([[], [{ ...ORG, ownerEmail: null }]]);

    const res = await POST(makeRequest(validNotification()));
    await runAfterCallbacks();

    expect(res.status).toBe(200);
    expect(sendPlanUpgradedEmail).not.toHaveBeenCalled();
    // Analytics still runs
    expect(trackEventImmediate).toHaveBeenCalled();
  });

  it("survives an email failure and still tracks analytics", async () => {
    mockOrgFound();
    vi.mocked(sendPlanUpgradedEmail).mockRejectedValueOnce(
      new Error("resend down"),
    );

    const res = await POST(makeRequest(validNotification()));
    await runAfterCallbacks();

    expect(res.status).toBe(200);
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(trackEventImmediate).toHaveBeenCalled();
  });

  it("survives an analytics failure without affecting the response", async () => {
    mockOrgFound();
    vi.mocked(trackEventImmediate).mockRejectedValueOnce(
      new Error("posthog down"),
    );

    const res = await POST(makeRequest(validNotification()));
    await expect(runAfterCallbacks()).resolves.toBeUndefined();

    expect(res.status).toBe(200);
  });
});
