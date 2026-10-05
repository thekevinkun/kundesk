// Direct tests for settlePaidOrder — the ONE function that activates a paid Midtrans order,
// shared by the webhook and the reconcile cron. The webhook route tests already exercise it
// indirectly; these cover what the route cannot reach: promo orders, what happens INSIDE the
// transaction, rollback behaviour, amount parsing, and post-commit details.
// NOTE: SQL behaviour (the LEFT() prefix filter, constraints, the real transaction rollback)
// cannot be verified with mocks (rule 262) — these tests cover the function's control flow.
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { trackEventImmediate } from "@/lib/posthog";
import { sendPlanUpgradedEmail } from "@/lib/email";
import { createNotification } from "@/lib/db/queries/dashboard";
import {
  activateSubscription,
  markPaymentSuccess,
  getPaymentByOrderId,
  OrgPurgingError,
} from "@/lib/db/queries/billing";
import { orgs, processedWebhooks, promoCodes } from "@/lib/db/schema";
import type { SettleInput } from "@/types/settlement";
import { settlePaidOrder } from "./settle-payment";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({
  paymentMode: "mock" as string,
  logoUrl: "https://example.com/logo.png",
}));
const afterCallbacks = vi.hoisted(
  () => [] as Array<() => Promise<void> | void>,
);
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
// after() only records its callback, so tests decide when the email/analytics work runs
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void> | void) => {
    afterCallbacks.push(callback);
  },
}));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({ trackEventImmediate: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendPlanUpgradedEmail: vi.fn() }));
vi.mock("@/lib/db/queries/dashboard", () => ({ createNotification: vi.fn() }));
// Real error class inside the factory — the function uses instanceof (rule 163)
vi.mock("@/lib/db/queries/billing", () => {
  class OrgPurgingError extends Error {
    constructor() {
      super("Organization is already being purged");
      this.name = "OrgPurgingError";
    }
  }
  return {
    OrgPurgingError,
    activateSubscription: vi.fn(),
    markPaymentSuccess: vi.fn(),
    getPaymentByOrderId: vi.fn(),
  };
});
// Plain functions, not spies: the objects they return are what the tests assert on
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => ({ a, b }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));
// promoCodes.id is deliberately different from orgs.id so eq() assertions are unambiguous
vi.mock("@/lib/db/schema", () => ({
  processedWebhooks: { id: "id", source: "source", externalId: "externalId" },
  orgs: { id: "id", name: "name", ownerEmail: "ownerEmail" },
  promoCodes: { id: "promoId", usedCount: "usedCount" },
}));

const mockActivate = vi.mocked(activateSubscription);
const mockMarkSuccess = vi.mocked(markPaymentSuccess);
const mockGetPayment = vi.mocked(getPaymentByOrderId);
const mockNotify = vi.mocked(createNotification);
const mockEmail = vi.mocked(sendPlanUpgradedEmail);
const mockTrack = vi.mocked(trackEventImmediate);
const mockCaptureMessage = vi.mocked(Sentry.captureMessage);
const mockCaptureException = vi.mocked(Sentry.captureException);

// Transaction handle and the spies behind it
const txInsertValues = vi.fn();
const txInsert = vi.fn();
const txUpdateWhere = vi.fn();
const txUpdateSet = vi.fn();
const txUpdate = vi.fn();
const tx = { insert: txInsert, update: txUpdate };
// Outer db.insert(...) — the markProcessed helper
const outerInsertValues = vi.fn();
const outerOnConflict = vi.fn();
// Records the argument of every db.select().from().where(...)
const selectWhere = vi.fn();

const ORG = {
  id: "org_3DZHfake123",
  name: "Test Org",
  ownerEmail: "owner@test.com",
};
const ORDER_ID = "KUNDESK-org_3DZH-STARTER-1234567890";
const PRO_ORDER_ID = "KUNDESK-org_3DZH-PRO-1234567890";
const PROMO_ORDER_ID = "KUNDESK-org_3DZH-STARTER-1234567890-P5";
const PERIOD_END = new Date("2026-11-04T00:00:00.000Z");

type CheckoutRow = {
  orgId: string | null;
  plan: string;
  amount: number;
  status: string;
};

// A checkout row as insertPendingPayment would have written it
function row(overrides: Partial<CheckoutRow> = {}): CheckoutRow {
  return {
    orgId: ORG.id,
    plan: "starter",
    amount: 149000,
    status: "pending",
    ...overrides,
  };
}

function input(overrides: Partial<SettleInput> = {}): SettleInput {
  return {
    orderId: ORDER_ID,
    grossAmount: "149000",
    paymentType: "bank_transfer",
    ...overrides,
  };
}

// What db.select().from().where() resolves to; records the where() argument
function selectChain(rows: Array<Record<string, unknown>>) {
  return {
    from: () => ({
      where: (arg: unknown) => {
        selectWhere(arg);
        return Promise.resolve(rows);
      },
    }),
  };
}

// Queue one select result per call, in call order (the order is part of the contract)
function mockSelectSequence(
  results: Array<Array<Record<string, unknown>>>,
): void {
  for (const rows of results) {
    mockDb.select.mockReturnValueOnce(selectChain(rows));
  }
}

// Runs everything the function handed to after() — the email and analytics work
async function runAfterCallbacks(): Promise<void> {
  await Promise.all(afterCallbacks.map((callback) => callback()));
}

describe("settlePaidOrder", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    afterCallbacks.length = 0;
    mockEnv.paymentMode = "mock";
    // Silence logging; keep handles for assertions
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Default: a pending checkout row exists and its org is found
    mockGetPayment.mockResolvedValue(row());
    mockDb.select.mockReturnValue(selectChain([ORG]));

    // Transaction runs its callback with the fake handle
    txInsertValues.mockResolvedValue(undefined);
    txInsert.mockReturnValue({ values: txInsertValues });
    txUpdateWhere.mockResolvedValue(undefined);
    txUpdateSet.mockReturnValue({ where: txUpdateWhere });
    txUpdate.mockReturnValue({ set: txUpdateSet });
    mockDb.transaction.mockImplementation(
      async (callback: (handle: typeof tx) => Promise<unknown>) => callback(tx),
    );

    // Outer insert: both `await values()` and `values().onConflictDoNothing()` are used
    outerOnConflict.mockResolvedValue(undefined);
    outerInsertValues.mockReturnValue({ onConflictDoNothing: outerOnConflict });
    mockDb.insert.mockReturnValue({ values: outerInsertValues });

    // Happy defaults for everything the activation touches
    mockActivate.mockResolvedValue({ periodEnd: PERIOD_END });
    mockMarkSuccess.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);
    mockEmail.mockResolvedValue(undefined);
    mockTrack.mockResolvedValue(undefined);
  });

  describe("order_id parsing", () => {
    it.each([
      ["too few parts", "KUNDESK-org_3DZH"],
      ["unknown plan", "KUNDESK-org_3DZH-ENTERPRISE-123"],
      ["lowercase plan", "KUNDESK-org_3DZH-starter-123"],
      ["org slice containing a hyphen", "KUNDESK-org-3DZH-STARTER-123"],
      ["org slice of 7 characters", "KUNDESK-org_3DZ-STARTER-123"],
      ["org slice of 9 characters", "KUNDESK-org_3DZHX-STARTER-123"],
      ["trailing junk", "KUNDESK-org_3DZH-STARTER-123-X"],
      ["promo suffix without digits", "KUNDESK-org_3DZH-STARTER-123-P"],
      ["wrong prefix", "OTHER-org_3DZH-STARTER-123"],
    ])("flags %s and touches nothing else", async (_label, orderId) => {
      const result = await settlePaidOrder(input({ orderId }));

      expect(result).toEqual({
        kind: "flagged",
        body: { message: "Unprocessable order_id — flagged for review" },
      });
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        "midtrans webhook: settled payment with unparseable order_id",
        { level: "error", extra: { orderId } },
      );
      // Nothing is looked up, activated or marked
      expect(mockGetPayment).not.toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe("checkout record", () => {
    // The reconcile cron relies on this: a recovered order must have a checkout row in real mode
    it("real mode: refuses a settlement with no checkout record, without marking it processed", async () => {
      mockEnv.paymentMode = "midtrans";
      mockGetPayment.mockResolvedValue(null);

      const result = await settlePaidOrder(input());

      expect(result).toEqual({
        kind: "flagged",
        body: { message: "No checkout record — flagged for review" },
      });
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        "midtrans webhook: settled payment has no checkout record",
        {
          level: "error",
          extra: { orderId: ORDER_ID, reportedAmount: 149000 },
        },
      );
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
      // CHARACTERIZATION — not marked processed (no checkout row means the reconcile cron
      // never revisits it either)
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("mock mode: with no checkout row, resolves the org by the 8-char prefix and trusts the reported amount", async () => {
      mockGetPayment.mockResolvedValue(null);

      const result = await settlePaidOrder(input());

      expect(result).toEqual({ kind: "activated" });
      // The prefix filter is sql`LEFT(${orgs.id}, 8) = ${slice}`
      expect(selectWhere).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ values: [orgs.id, "org_3DZH"] }),
      );
      // No row to compare against, so the reported amount is what gets recorded
      expect(mockMarkSuccess).toHaveBeenCalledWith(
        ORG.id,
        ORDER_ID,
        "starter",
        149000,
        "bank_transfer",
        tx,
      );
    });

    it.each(["cancelled", "expired", "failed"])(
      "still activates a settlement for a %s order, with a Sentry warning",
      async (status) => {
        mockGetPayment.mockResolvedValue(row({ status }));

        const result = await settlePaidOrder(input());

        expect(result).toEqual({ kind: "activated" });
        expect(mockCaptureMessage).toHaveBeenCalledWith(
          "midtrans webhook: settlement for a non-pending order",
          {
            level: "warning",
            extra: { orderId: ORDER_ID, rowStatus: status },
          },
        );
      },
    );
  });

  describe("org resolution", () => {
    it("resolves the org by the full orgId stored on the checkout row", async () => {
      await settlePaidOrder(input());
      expect(selectWhere).toHaveBeenNthCalledWith(1, { a: orgs.id, b: ORG.id });
    });

    it("a purged org (no orgId on the row) is flagged WITHOUT any org lookup, and marked processed", async () => {
      mockGetPayment.mockResolvedValue(row({ orgId: null }));

      const result = await settlePaidOrder(input());

      expect(result).toEqual({
        kind: "flagged",
        body: { error: "Org resolution failed" },
      });
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(outerInsertValues).toHaveBeenCalledWith({
        externalId: ORDER_ID,
        source: "midtrans",
      });
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        "midtrans webhook: org resolution failed",
        {
          level: "error",
          extra: {
            orderId: ORDER_ID,
            orgIdSlice: "org_3DZH",
            matches: 0,
            hasCheckoutRecord: true,
          },
        },
      );
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe("amount handling", () => {
    it("parses a decimal gross amount ('99000.00') to a whole number", async () => {
      mockGetPayment.mockResolvedValue(row({ amount: 99000 }));

      const result = await settlePaidOrder(input({ grossAmount: "99000.00" }));

      expect(result).toEqual({ kind: "activated" });
      expect(mockMarkSuccess).toHaveBeenCalledWith(
        ORG.id,
        ORDER_ID,
        "starter",
        99000,
        "bank_transfer",
        tx,
      );
    });

    it("on a mismatch: flags it, alerts Sentry, marks it processed and activates nothing", async () => {
      const result = await settlePaidOrder(input({ grossAmount: "1000" }));

      expect(result).toEqual({
        kind: "flagged",
        body: { message: "Amount mismatch — flagged for review" },
      });
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        "midtrans webhook: amount mismatch",
        {
          level: "error",
          extra: {
            orgId: ORG.id,
            orderId: ORDER_ID,
            expectedAmount: 149000,
            reportedAmount: 1000,
          },
        },
      );
      // Marked processed so nobody retries — support handles it from Sentry
      expect(outerInsertValues).toHaveBeenCalledWith({
        externalId: ORDER_ID,
        source: "midtrans",
      });
      expect(outerOnConflict).toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("treats an unparseable gross amount as a mismatch (never activates)", async () => {
      const result = await settlePaidOrder(input({ grossAmount: "abc" }));

      expect(result.kind).toBe("flagged");
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe("activation transaction", () => {
    it("activates the plan and records the payment in one transaction", async () => {
      const result = await settlePaidOrder(input());

      expect(result).toEqual({ kind: "activated" });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      // The SAME tx handle goes to both, so they commit or roll back together
      expect(mockActivate).toHaveBeenCalledWith(
        ORG.id,
        "starter",
        "bank_transfer",
        tx,
      );
      expect(mockMarkSuccess).toHaveBeenCalledWith(
        ORG.id,
        ORDER_ID,
        "starter",
        149000,
        "bank_transfer",
        tx,
      );
      // Normal path: no Sentry noise at all
      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });

    it("activates the Pro plan for a PRO order", async () => {
      mockGetPayment.mockResolvedValue(row({ plan: "pro", amount: 399000 }));

      await settlePaidOrder(
        input({ orderId: PRO_ORDER_ID, grossAmount: "399000" }),
      );

      expect(mockActivate).toHaveBeenCalledWith(
        ORG.id,
        "pro",
        "bank_transfer",
        tx,
      );
    });

    // The code comment calls this critical: if the marker were written OUTSIDE the
    // transaction, a rollback would leave the order "processed" with nothing activated
    it("writes the processedWebhooks marker INSIDE the transaction, not through the outer db", async () => {
      await settlePaidOrder(input());

      expect(txInsert).toHaveBeenCalledWith(processedWebhooks);
      expect(txInsertValues).toHaveBeenCalledWith({
        externalId: ORDER_ID,
        source: "midtrans",
      });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("runs in the safe order: activate → record payment → marker", async () => {
      await settlePaidOrder(input());

      const order = [
        mockActivate.mock.invocationCallOrder[0],
        mockMarkSuccess.mock.invocationCallOrder[0],
        txInsertValues.mock.invocationCallOrder[0],
      ] as number[];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("a normal order has no promo update", async () => {
      await settlePaidOrder(input());
      expect(txUpdate).not.toHaveBeenCalled();
    });
  });

  describe("promo orders (-P{id})", () => {
    beforeEach(() => {
      mockGetPayment.mockResolvedValue(row({ amount: 119200 }));
    });

    it("increments the promo's usedCount by 1 inside the transaction", async () => {
      const result = await settlePaidOrder(
        input({ orderId: PROMO_ORDER_ID, grossAmount: "119200" }),
      );

      expect(result).toEqual({ kind: "activated" });
      expect(txUpdate).toHaveBeenCalledWith(promoCodes);
      expect(txUpdateSet).toHaveBeenCalledWith({
        usedCount: expect.objectContaining({ values: [promoCodes.usedCount] }),
      });
      // The promo id comes from the order_id suffix
      expect(txUpdateWhere).toHaveBeenCalledWith({ a: promoCodes.id, b: 5 });
    });

    it("runs in the safe order: activate → record payment → promo → marker", async () => {
      await settlePaidOrder(
        input({ orderId: PROMO_ORDER_ID, grossAmount: "119200" }),
      );

      const order = [
        mockActivate.mock.invocationCallOrder[0],
        mockMarkSuccess.mock.invocationCallOrder[0],
        txUpdate.mock.invocationCallOrder[0],
        txInsertValues.mock.invocationCallOrder[0],
      ] as number[];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("reports has_promo true to analytics", async () => {
      await settlePaidOrder(
        input({ orderId: PROMO_ORDER_ID, grossAmount: "119200" }),
      );
      await runAfterCallbacks();

      expect(mockTrack).toHaveBeenCalledWith(ORG.id, "plan_upgraded", {
        plan: "starter",
        payment_type: "bank_transfer",
        has_promo: true,
      });
    });

    it("a failing promo update rolls everything back: rethrown, no marker, no post-commit work", async () => {
      txUpdateWhere.mockRejectedValueOnce(new Error("neon timeout"));

      await expect(
        settlePaidOrder(
          input({ orderId: PROMO_ORDER_ID, grossAmount: "119200" }),
        ),
      ).rejects.toThrow("neon timeout");

      expect(txInsertValues).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
      expect(afterCallbacks).toHaveLength(0);
    });
  });

  describe("failures inside the transaction", () => {
    // An ordinary error is rethrown so the caller retries (webhook → 503, cron → next run).
    // Because the marker is inside the transaction, nothing is left marked as processed.
    it.each([
      [
        "activation",
        () => mockActivate.mockRejectedValueOnce(new Error("neon timeout")),
      ],
      [
        "recording the payment",
        () => mockMarkSuccess.mockRejectedValueOnce(new Error("neon timeout")),
      ],
    ])(
      "a failure while %s is rethrown, with no marker and no post-commit work",
      async (_label, arrange) => {
        arrange();

        await expect(settlePaidOrder(input())).rejects.toThrow("neon timeout");

        expect(txInsertValues).not.toHaveBeenCalled();
        expect(mockDb.insert).not.toHaveBeenCalled();
        expect(mockNotify).not.toHaveBeenCalled();
        expect(afterCallbacks).toHaveLength(0);
      },
    );

    it("org being purged: flagged, marked processed outside the rolled-back transaction, Sentry error", async () => {
      mockActivate.mockRejectedValueOnce(new OrgPurgingError());

      const result = await settlePaidOrder(input());

      expect(result).toEqual({
        kind: "flagged",
        body: { message: "Activation failed — flagged for review" },
      });
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        "midtrans webhook: activation failed post-purge-guard",
        { level: "error", extra: { orderId: ORDER_ID, orgId: ORG.id } },
      );
      expect(outerInsertValues).toHaveBeenCalledWith({
        externalId: ORDER_ID,
        source: "midtrans",
      });
      expect(mockNotify).not.toHaveBeenCalled();
      expect(afterCallbacks).toHaveLength(0);
    });

    it("org being purged: if recording the outcome also fails, that error is rethrown", async () => {
      mockActivate.mockRejectedValueOnce(new OrgPurgingError());
      outerOnConflict.mockRejectedValueOnce(new Error("ETIMEDOUT"));

      await expect(settlePaidOrder(input())).rejects.toThrow("ETIMEDOUT");
    });
  });

  describe("unique violation (a concurrent run)", () => {
    it.each([
      [
        "code on the error",
        () => Object.assign(new Error("duplicate key"), { code: "23505" }),
      ],
      [
        "code on err.cause (Drizzle style)",
        () => new Error("wrapped", { cause: { code: "23505" } }),
      ],
    ])(
      "%s: already_processed when the order is confirmed finished",
      async (_label, makeError) => {
        mockDb.transaction.mockRejectedValueOnce(makeError());
        // 1st select = org lookup, 2nd = the re-check that confirms the marker exists
        mockSelectSequence([[ORG], [{ id: 1 }]]);

        const result = await settlePaidOrder(input());

        expect(result).toEqual({ kind: "already_processed" });
        // The re-check asks for THIS order's midtrans marker
        expect(selectWhere).toHaveBeenNthCalledWith(2, [
          { a: processedWebhooks.source, b: "midtrans" },
          { a: processedWebhooks.externalId, b: ORDER_ID },
        ]);
        // The other run owns the notification, the email and the analytics
        expect(mockNotify).not.toHaveBeenCalled();
        expect(afterCallbacks).toHaveLength(0);
        expect(mockCaptureMessage).not.toHaveBeenCalled();
      },
    );

    it("rethrows the error when no marker exists (the violation came from somewhere else)", async () => {
      const err = Object.assign(new Error("duplicate key"), { code: "23505" });
      mockDb.transaction.mockRejectedValueOnce(err);
      mockSelectSequence([[ORG], []]);

      await expect(settlePaidOrder(input())).rejects.toBe(err);
    });

    it("any other database error code is rethrown WITHOUT the re-check", async () => {
      const err = Object.assign(new Error("deadlock"), { code: "40001" });
      mockDb.transaction.mockRejectedValueOnce(err);

      await expect(settlePaidOrder(input())).rejects.toBe(err);
      // Only the org lookup ran — no second select
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("a thrown non-object value is rethrown as is", async () => {
      mockDb.transaction.mockRejectedValueOnce("boom");

      await expect(settlePaidOrder(input())).rejects.toBe("boom");
    });
  });

  describe("post-commit work", () => {
    it("creates the dashboard notification AFTER the transaction commits", async () => {
      await settlePaidOrder(input());

      expect(mockNotify).toHaveBeenCalledWith(
        ORG.id,
        "plan_upgraded",
        "Plan berhasil diupgrade ke Starter",
        `Pembayaran dikonfirmasi · ${ORDER_ID}`,
      );
      const txOrder = mockDb.transaction.mock.invocationCallOrder[0] as number;
      const notifyOrder = mockNotify.mock.invocationCallOrder[0] as number;
      expect(txOrder).toBeLessThan(notifyOrder);
    });

    it("labels the notification 'Pro' for a Pro order", async () => {
      mockGetPayment.mockResolvedValue(row({ plan: "pro", amount: 399000 }));

      await settlePaidOrder(
        input({ orderId: PRO_ORDER_ID, grossAmount: "399000" }),
      );

      expect(mockNotify).toHaveBeenCalledWith(
        ORG.id,
        "plan_upgraded",
        "Plan berhasil diupgrade ke Pro",
        `Pembayaran dikonfirmasi · ${PRO_ORDER_ID}`,
      );
    });

    it("does not send the email or track analytics until after() runs", async () => {
      await settlePaidOrder(input());

      expect(afterCallbacks).toHaveLength(1);
      expect(mockEmail).not.toHaveBeenCalled();
      expect(mockTrack).not.toHaveBeenCalled();

      await runAfterCallbacks();

      expect(mockEmail).toHaveBeenCalledTimes(1);
      expect(mockTrack).toHaveBeenCalledTimes(1);
    });

    it("sends the upgrade email with the period end returned by activation", async () => {
      await settlePaidOrder(input());
      await runAfterCallbacks();

      expect(mockEmail).toHaveBeenCalledWith(
        ORG.ownerEmail,
        ORG.name,
        "starter",
        149000,
        "bank_transfer",
        ORDER_ID,
        expect.any(Date),
        PERIOD_END,
        mockEnv.logoUrl,
      );
    });

    it("tracks plan_upgraded with has_promo false for a normal order", async () => {
      await settlePaidOrder(input());
      await runAfterCallbacks();

      expect(mockTrack).toHaveBeenCalledWith(ORG.id, "plan_upgraded", {
        plan: "starter",
        payment_type: "bank_transfer",
        has_promo: false,
      });
    });

    it("a failing notification is reported but never undoes the activation, and the email still goes out", async () => {
      const boom = new Error("db down");
      mockNotify.mockRejectedValueOnce(boom);

      const result = await settlePaidOrder(input());
      await runAfterCallbacks();

      expect(result).toEqual({ kind: "activated" });
      expect(mockCaptureException).toHaveBeenCalledWith(boom, {
        extra: { orgId: ORG.id, orderId: ORDER_ID },
      });
      expect(mockEmail).toHaveBeenCalledTimes(1);
    });

    it("a failing email is reported with context, and analytics still runs", async () => {
      const boom = new Error("resend down");
      mockEmail.mockRejectedValueOnce(boom);

      const result = await settlePaidOrder(input());
      await runAfterCallbacks();

      expect(result).toEqual({ kind: "activated" });
      expect(mockCaptureException).toHaveBeenCalledWith(boom, {
        extra: { orgId: ORG.id, orderId: ORDER_ID },
      });
      expect(mockTrack).toHaveBeenCalledTimes(1);
    });

    it("an org with no owner email skips the email with a warning, and analytics still runs", async () => {
      mockDb.select.mockReturnValue(
        selectChain([{ ...ORG, ownerEmail: null }]),
      );

      const result = await settlePaidOrder(input());
      await runAfterCallbacks();

      expect(result).toEqual({ kind: "activated" });
      expect(mockEmail).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(mockTrack).toHaveBeenCalledTimes(1);
    });

    it("an analytics failure never rejects the after() work and is not sent to Sentry", async () => {
      mockTrack.mockRejectedValueOnce(new Error("posthog down"));

      await settlePaidOrder(input());

      await expect(runAfterCallbacks()).resolves.toBeUndefined();
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });
});
