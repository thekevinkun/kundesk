// Tests for lib/actions/billing.ts — createPayment, cancelPendingPaymentAction,
// cancelSubscriptionAction.
// NOTE: promo validity, first-purchase flags and DB constraints live in the query layer and
// SQL (mocked here, rule 262) — these tests cover the actions' control flow and the money
// math: which price is charged, in what order things happen, what the user is told.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { requireOrgAdmin } from "@/lib/auth";
import {
  createSubscriptionTransaction,
  cancelMidtransPayment,
} from "@/lib/midtrans";
import { sendPaymentPendingEmail } from "@/lib/email";
import {
  cancelSubscription,
  validatePromoCode,
  getPendingPayment,
  insertPendingPayment,
  cancelPendingPayment,
} from "@/lib/db/queries/billing";
import {
  PLAN_PRICE,
  PLAN_FIRST_TIME_PRICE,
  type PendingPayment,
  type PromoCode,
} from "@/types/billing";
import {
  createPayment,
  cancelPendingPaymentAction,
  cancelSubscriptionAction,
} from "./billing";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({ logoUrl: "https://example.com/logo.png" }));
const mockDb = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({ requireOrgAdmin: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/midtrans", () => ({
  createSubscriptionTransaction: vi.fn(),
  cancelMidtransPayment: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ sendPaymentPendingEmail: vi.fn() }));
vi.mock("@/lib/db/queries/billing", () => ({
  cancelSubscription: vi.fn(),
  validatePromoCode: vi.fn(),
  getPendingPayment: vi.fn(),
  insertPendingPayment: vi.fn(),
  cancelPendingPayment: vi.fn(),
}));

const mockRevalidate = vi.mocked(revalidatePath);
const mockCaptureMessage = vi.mocked(Sentry.captureMessage);
const mockCaptureException = vi.mocked(Sentry.captureException);
const mockCurrentUser = vi.mocked(currentUser);
const mockRequireAdmin = vi.mocked(requireOrgAdmin);
const mockCreateTx = vi.mocked(createSubscriptionTransaction);
const mockCancelMidtrans = vi.mocked(cancelMidtransPayment);
const mockSendEmail = vi.mocked(sendPaymentPendingEmail);
const mockCancelSub = vi.mocked(cancelSubscription);
const mockValidatePromo = vi.mocked(validatePromoCode);
const mockGetPending = vi.mocked(getPendingPayment);
const mockInsertPending = vi.mocked(insertPendingPayment);
const mockCancelPending = vi.mocked(cancelPendingPayment);

const ORG_ID = "org_a";
const ORDER_ID = "KUNDESK-org_a000-STARTER-1";
const SNAP_URL = "https://app.sandbox.midtrans.com/snap/v4/redirection/abc";
const GENERIC_PAY_ERROR =
  "Gagal membuat transaksi. Coba lagi dalam beberapa saat.";
const GENERIC_CANCEL_ERROR = "Gagal membatalkan transaksi. Coba lagi.";

type OrgRow = {
  name: string;
  ownerEmail: string | null;
  hasUsedFirstPurchase: boolean;
};

// The org lookup is `db.select().from().where().then(rows => rows[0] ?? null)`,
// so where() must return a real promise
function setOrg(org: OrgRow | null): void {
  mockDb.select.mockReturnValue({
    from: () => ({ where: () => Promise.resolve(org ? [org] : []) }),
  });
}

// currentUser() resolves to a Clerk User — only the email list is read
function setClerkUser(email: string | null): void {
  mockCurrentUser.mockResolvedValue(
    (email
      ? { emailAddresses: [{ emailAddress: email }] }
      : null) as unknown as Awaited<ReturnType<typeof currentUser>>,
  );
}

function form(fields: { plan?: string; promoCode?: string }): FormData {
  const fd = new FormData();
  if (fields.plan !== undefined) fd.set("plan", fields.plan);
  if (fields.promoCode !== undefined) fd.set("promoCode", fields.promoCode);
  return fd;
}

function promo(discountPercent: number, id = 5): PromoCode {
  return {
    id,
    code: "HEMAT",
    discountPercent,
    applicablePlans: null,
    validUntil: null,
    maxUses: null,
    usedCount: 0,
  };
}

function pendingPayment(): PendingPayment {
  return {
    orderId: ORDER_ID,
    plan: "starter",
    amount: PLAN_PRICE.starter,
    redirectUrl: SNAP_URL,
    createdAt: new Date("2026-10-05T01:00:00.000Z"),
  };
}

// Lets a fire-and-forget `.catch()` handler run before we assert on it
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("lib/actions/billing", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    // Silence action logging
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Happy defaults: an admin, a first-time org, no pending payment, Midtrans works
    mockRequireAdmin.mockResolvedValue({ userId: "user_1", orgId: ORG_ID });
    setOrg({
      name: "Warung A",
      ownerEmail: "owner@example.com",
      hasUsedFirstPurchase: false,
    });
    setClerkUser("clerk@example.com");
    mockGetPending.mockResolvedValue(null);
    mockCreateTx.mockResolvedValue({
      token: "tok",
      redirectUrl: SNAP_URL,
      orderId: ORDER_ID,
    });
    mockInsertPending.mockResolvedValue(undefined);
    // The action calls .catch() on this, so the default must be a real promise
    mockSendEmail.mockResolvedValue(undefined);
    mockCancelMidtrans.mockResolvedValue(true);
    mockCancelPending.mockResolvedValue(undefined);
    mockCancelSub.mockResolvedValue(undefined);
  });

  describe("createPayment", () => {
    describe("auth and input", () => {
      it("throws for a non-admin and touches nothing (requireOrgAdmin is outside the try)", async () => {
        mockRequireAdmin.mockRejectedValueOnce(new Error("Hanya admin"));
        await expect(
          createPayment(null, form({ plan: "starter" })),
        ).rejects.toThrow("Hanya admin");
        expect(mockCreateTx).not.toHaveBeenCalled();
        expect(mockGetPending).not.toHaveBeenCalled();
      });

      it("rejects an unknown plan without calling Midtrans", async () => {
        const result = await createPayment(null, form({ plan: "enterprise" }));
        expect(result).toEqual({
          success: false,
          error: "Invalid plan selected.",
        });
        expect(mockCreateTx).not.toHaveBeenCalled();
      });

      it("rejects a missing plan", async () => {
        const result = await createPayment(null, form({}));
        expect(result).toEqual({
          success: false,
          error: "Invalid plan selected.",
        });
        expect(mockCreateTx).not.toHaveBeenCalled();
      });

      it("rejects the free plan (only starter and pro can be bought)", async () => {
        const result = await createPayment(null, form({ plan: "free" }));
        expect(result.success).toBe(false);
        expect(mockCreateTx).not.toHaveBeenCalled();
      });

      // CHARACTERIZATION — a promo code over 50 chars fails the same schema as a bad plan,
      // so the user sees the plan error message
      it("a promo code over 50 characters returns the 'Invalid plan selected.' message", async () => {
        const result = await createPayment(
          null,
          form({ plan: "starter", promoCode: "x".repeat(51) }),
        );
        expect(result).toEqual({
          success: false,
          error: "Invalid plan selected.",
        });
        expect(mockCreateTx).not.toHaveBeenCalled();
      });
    });

    describe("pending payment guard", () => {
      it("returns the existing redirectUrl instead of creating a second transaction", async () => {
        mockGetPending.mockResolvedValueOnce(pendingPayment());
        const result = await createPayment(null, form({ plan: "starter" }));
        expect(result).toEqual({
          success: false,
          error: expect.any(String),
          redirectUrl: SNAP_URL,
        });
        expect(mockCreateTx).not.toHaveBeenCalled();
        expect(mockInsertPending).not.toHaveBeenCalled();
        // The guard runs before the org and Clerk lookups
        expect(mockCurrentUser).not.toHaveBeenCalled();
        expect(mockDb.select).not.toHaveBeenCalled();
      });
    });

    it("fails with a clear message when the org row is missing", async () => {
      setOrg(null);
      const result = await createPayment(null, form({ plan: "starter" }));
      expect(result).toEqual({
        success: false,
        error: "Organisasi tidak ditemukan.",
      });
      expect(mockCreateTx).not.toHaveBeenCalled();
    });

    describe("price calculation", () => {
      it("charges the first-time price to an org that never bought before", async () => {
        const result = await createPayment(null, form({ plan: "starter" }));
        expect(result).toEqual({
          success: true,
          redirectUrl: SNAP_URL,
          finalAmount: PLAN_FIRST_TIME_PRICE.starter,
        });
        expect(mockCreateTx).toHaveBeenCalledWith(
          ORG_ID,
          "starter",
          "clerk@example.com",
          PLAN_FIRST_TIME_PRICE.starter,
          undefined,
        );
      });

      it("charges the Pro first-time price for Pro", async () => {
        const result = await createPayment(null, form({ plan: "pro" }));
        expect(result).toMatchObject({
          success: true,
          finalAmount: PLAN_FIRST_TIME_PRICE.pro,
        });
      });

      it("charges the regular price once the org has bought before", async () => {
        setOrg({
          name: "Warung A",
          ownerEmail: "owner@example.com",
          hasUsedFirstPurchase: true,
        });
        const result = await createPayment(null, form({ plan: "starter" }));
        expect(result).toMatchObject({
          success: true,
          finalAmount: PLAN_PRICE.starter,
        });
      });

      it("applies a valid promo to the REGULAR price and passes the promo id to Midtrans", async () => {
        setOrg({
          name: "Warung A",
          ownerEmail: "owner@example.com",
          hasUsedFirstPurchase: true,
        });
        mockValidatePromo.mockResolvedValueOnce(promo(20, 7));
        const result = await createPayment(
          null,
          form({ plan: "starter", promoCode: "HEMAT" }),
        );

        const expected = Math.floor(PLAN_PRICE.starter * (1 - 20 / 100));
        expect(result).toMatchObject({ success: true, finalAmount: expected });
        expect(mockValidatePromo).toHaveBeenCalledWith("HEMAT", "starter");
        expect(mockCreateTx).toHaveBeenCalledWith(
          ORG_ID,
          "starter",
          "clerk@example.com",
          expected,
          7,
        );
      });

      it("a promo replaces the first-time price (the two never stack)", async () => {
        // org is first-time, but a promo code was entered
        mockValidatePromo.mockResolvedValueOnce(promo(10));
        const result = await createPayment(
          null,
          form({ plan: "starter", promoCode: "HEMAT" }),
        );
        expect(result).toMatchObject({
          success: true,
          finalAmount: Math.floor(PLAN_PRICE.starter * (1 - 10 / 100)),
        });
      });

      it("rounds a fractional discount down to a whole rupiah", async () => {
        mockValidatePromo.mockResolvedValueOnce(promo(33));
        const result = await createPayment(
          null,
          form({ plan: "pro", promoCode: "HEMAT" }),
        );
        expect(result.success).toBe(true);
        if (result.success)
          expect(Number.isInteger(result.finalAmount)).toBe(true);
      });

      it("rejects an invalid promo and creates no transaction", async () => {
        mockValidatePromo.mockResolvedValueOnce(null);
        const result = await createPayment(
          null,
          form({ plan: "starter", promoCode: "NOPE" }),
        );
        expect(result.success).toBe(false);
        expect(mockCreateTx).not.toHaveBeenCalled();
        expect(mockInsertPending).not.toHaveBeenCalled();
      });

      it("treats a whitespace-only promo code as no promo (first-time price applies)", async () => {
        const result = await createPayment(
          null,
          form({ plan: "starter", promoCode: "   " }),
        );
        expect(mockValidatePromo).not.toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          finalAmount: PLAN_FIRST_TIME_PRICE.starter,
        });
      });
    });

    describe("customer email", () => {
      it("falls back to a placeholder address when Clerk has no user email", async () => {
        setClerkUser(null);
        await createPayment(null, form({ plan: "starter" }));
        expect(mockCreateTx).toHaveBeenCalledWith(
          ORG_ID,
          "starter",
          "noemail@kundesk.app",
          expect.any(Number),
          undefined,
        );
      });

      it("sends the pending-payment email to the org's ownerEmail", async () => {
        await createPayment(null, form({ plan: "starter" }));
        expect(mockSendEmail).toHaveBeenCalledWith(
          "owner@example.com",
          "Warung A",
          "starter",
          PLAN_FIRST_TIME_PRICE.starter,
          SNAP_URL,
          mockEnv.logoUrl,
        );
      });

      it("falls back to the Clerk email when the org has no ownerEmail", async () => {
        setOrg({
          name: "Warung A",
          ownerEmail: null,
          hasUsedFirstPurchase: false,
        });
        await createPayment(null, form({ plan: "starter" }));
        expect(mockSendEmail).toHaveBeenCalledWith(
          "clerk@example.com",
          "Warung A",
          "starter",
          expect.any(Number),
          SNAP_URL,
          mockEnv.logoUrl,
        );
      });
    });

    describe("success path", () => {
      it("records the pending payment with the order id, plan, amount and url", async () => {
        await createPayment(null, form({ plan: "starter" }));
        expect(mockInsertPending).toHaveBeenCalledWith(
          ORG_ID,
          ORDER_ID,
          "starter",
          PLAN_FIRST_TIME_PRICE.starter,
          SNAP_URL,
        );
      });

      it("runs in the real order: create transaction → record pending row → email → revalidate", async () => {
        await createPayment(null, form({ plan: "starter" }));
        const order = [
          mockCreateTx.mock.invocationCallOrder[0],
          mockInsertPending.mock.invocationCallOrder[0],
          mockSendEmail.mock.invocationCallOrder[0],
          mockRevalidate.mock.invocationCallOrder[0],
        ] as number[];
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(mockRevalidate).toHaveBeenCalledWith("/dashboard/billing");
      });

      it("a failing pending-payment email never blocks the checkout redirect", async () => {
        mockSendEmail.mockRejectedValueOnce(new Error("resend down"));
        const result = await createPayment(null, form({ plan: "starter" }));
        await flush();
        expect(result).toMatchObject({ success: true, redirectUrl: SNAP_URL });
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe("failures", () => {
      it("returns the generic error when Midtrans fails, with no row and no email", async () => {
        mockCreateTx.mockRejectedValueOnce(new Error("midtrans 500"));
        const result = await createPayment(null, form({ plan: "starter" }));
        expect(result).toEqual({ success: false, error: GENERIC_PAY_ERROR });
        expect(mockInsertPending).not.toHaveBeenCalled();
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockRevalidate).not.toHaveBeenCalled();
      });

      it("on a concurrent-request unique violation (23505) returns the existing payment's url", async () => {
        mockGetPending
          .mockResolvedValueOnce(null) // the guard at the top
          .mockResolvedValueOnce(pendingPayment()); // the lookup in the catch
        mockInsertPending.mockRejectedValueOnce(
          Object.assign(new Error("duplicate key"), { code: "23505" }),
        );
        const result = await createPayment(null, form({ plan: "starter" }));
        expect(result).toEqual({
          success: false,
          error: expect.any(String),
          redirectUrl: SNAP_URL,
        });
        expect(mockSendEmail).not.toHaveBeenCalled();
      });

      it("on 23505 with no existing pending row falls back to the generic error", async () => {
        mockInsertPending.mockRejectedValueOnce(
          Object.assign(new Error("duplicate key"), { code: "23505" }),
        );
        const result = await createPayment(null, form({ plan: "starter" }));
        expect(result).toEqual({ success: false, error: GENERIC_PAY_ERROR });
      });

      it("any other error while recording the row returns the generic error, no email", async () => {
        mockInsertPending.mockRejectedValueOnce(new Error("connection reset"));
        const result = await createPayment(null, form({ plan: "starter" }));
        expect(result).toEqual({ success: false, error: GENERIC_PAY_ERROR });
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockRevalidate).not.toHaveBeenCalled();
      });
    });
  });

  describe("cancelPendingPaymentAction", () => {
    it("closes at Midtrans first, then in the DB, using the order from OUR database", async () => {
      mockGetPending.mockResolvedValueOnce(pendingPayment());
      const result = await cancelPendingPaymentAction();

      expect(result).toEqual({ success: true });
      expect(mockCancelMidtrans).toHaveBeenCalledWith(ORDER_ID, SNAP_URL);
      expect(mockCancelPending).toHaveBeenCalledWith(ORG_ID);
      expect(mockRevalidate).toHaveBeenCalledWith("/dashboard/billing");
      const midtransOrder = mockCancelMidtrans.mock
        .invocationCallOrder[0] as number;
      const dbOrder = mockCancelPending.mock.invocationCallOrder[0] as number;
      expect(midtransOrder).toBeLessThan(dbOrder);
    });

    it("with no live pending payment skips Midtrans but still cleans up stale rows", async () => {
      const result = await cancelPendingPaymentAction();
      expect(result).toEqual({ success: true });
      expect(mockCancelMidtrans).not.toHaveBeenCalled();
      expect(mockCancelPending).toHaveBeenCalledWith(ORG_ID);
    });

    it("keeps the row pending and warns Sentry when Midtrans refuses", async () => {
      mockGetPending.mockResolvedValueOnce(pendingPayment());
      mockCancelMidtrans.mockResolvedValueOnce(false);
      const result = await cancelPendingPaymentAction();

      expect(result.success).toBe(false);
      expect(result.error).toEqual(expect.any(String));
      expect(mockCancelPending).not.toHaveBeenCalled();
      expect(mockRevalidate).not.toHaveBeenCalled();
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        "cancel payment: Midtrans refused",
        {
          level: "warning",
          extra: { orgId: ORG_ID, orderId: ORDER_ID },
        },
      );
    });

    it("returns the generic error and reports to Sentry when the Midtrans call throws", async () => {
      const boom = new Error("missing credentials");
      mockGetPending.mockResolvedValueOnce(pendingPayment());
      mockCancelMidtrans.mockRejectedValueOnce(boom);
      const result = await cancelPendingPaymentAction();

      expect(result).toEqual({ success: false, error: GENERIC_CANCEL_ERROR });
      expect(mockCancelPending).not.toHaveBeenCalled();
      expect(mockCaptureException).toHaveBeenCalledWith(boom);
    });

    it("when the DB update fails after Midtrans closed it, returns the generic error (pressing again works)", async () => {
      const boom = new Error("neon timeout");
      mockGetPending.mockResolvedValueOnce(pendingPayment());
      mockCancelPending.mockRejectedValueOnce(boom);
      const result = await cancelPendingPaymentAction();

      expect(result).toEqual({ success: false, error: GENERIC_CANCEL_ERROR });
      expect(mockCaptureException).toHaveBeenCalledWith(boom);
    });

    // CHARACTERIZATION — requireOrgAdmin is INSIDE this action's try, so a non-admin gets the
    // generic message and a Sentry exception instead of a thrown error
    it("a non-admin gets the generic error, nothing is cancelled, and Sentry is notified", async () => {
      const denied = new Error("Hanya admin");
      mockRequireAdmin.mockRejectedValueOnce(denied);
      const result = await cancelPendingPaymentAction();

      expect(result).toEqual({ success: false, error: GENERIC_CANCEL_ERROR });
      expect(mockGetPending).not.toHaveBeenCalled();
      expect(mockCancelMidtrans).not.toHaveBeenCalled();
      expect(mockCancelPending).not.toHaveBeenCalled();
      expect(mockCaptureException).toHaveBeenCalledWith(denied);
    });
  });

  describe("cancelSubscriptionAction", () => {
    it("cancels the org's subscription and revalidates the dashboard and billing pages", async () => {
      const result = await cancelSubscriptionAction(null, new FormData());
      expect(result).toEqual({ success: true });
      expect(mockCancelSub).toHaveBeenCalledWith(ORG_ID);
      expect(mockRevalidate).toHaveBeenCalledWith("/dashboard");
      expect(mockRevalidate).toHaveBeenCalledWith("/dashboard/billing");
    });

    it("throws for a non-admin and cancels nothing (requireOrgAdmin is outside the try)", async () => {
      mockRequireAdmin.mockRejectedValueOnce(new Error("Hanya admin"));
      await expect(
        cancelSubscriptionAction(null, new FormData()),
      ).rejects.toThrow("Hanya admin");
      expect(mockCancelSub).not.toHaveBeenCalled();
    });

    // CHARACTERIZATION — only console.error here, no Sentry (unlike cancelPendingPaymentAction)
    it("returns an error and does not revalidate when the DB update fails", async () => {
      mockCancelSub.mockRejectedValueOnce(new Error("neon timeout"));
      const result = await cancelSubscriptionAction(null, new FormData());
      expect(result).toEqual({
        success: false,
        error: "Gagal membatalkan langganan. Coba lagi.",
      });
      expect(mockRevalidate).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });
});
