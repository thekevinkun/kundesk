// Unit tests for lib/midtrans/index.ts
// Tests the actual cryptographic signature verification — not mocked
// Also covers order ID generation and format validation

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";

// ── Mock @/lib/env ──
// env.ts calls requireEnv() at module load — throws without real vars.
// vi.hoisted makes the object mutable so cancel tests can flip paymentMode.
const mockEnv = vi.hoisted(() => ({
  midtransServerKey: "test-server-key-12345" as string | undefined,
  midtransClientKey: "test-client-key-12345",
  midtransProduction: false,
  paymentMode: "mock" as string,
  appUrl: "http://localhost:3000",
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

// ── Import after mocks ──
import {
  verifyMidtransSignature,
  generateOrderId,
  cancelMidtransPayment,
} from "./index";
import type { MidtransNotification } from "@/types/billing";

// ── Helper: build a valid notification with correct signature ──
// This is the exact same SHA512 formula Midtrans uses on their end
// If our implementation matches this, real Midtrans notifications will verify
function buildValidNotification(
  overrides: Partial<MidtransNotification> = {},
): MidtransNotification {
  const base: Omit<MidtransNotification, "signature_key"> = {
    order_id: "KUNDESK-org_3DZH-STARTER-1234567890",
    status_code: "200",
    gross_amount: "149000",
    transaction_status: "settlement",
    fraud_status: "accept",
    payment_type: "bank_transfer",
    transaction_id: "txn_abc123",
    ...overrides,
  };

  // Compute the correct signature the same way Midtrans does
  // SHA512(order_id + status_code + gross_amount + server_key)
  const raw = `${base.order_id}${base.status_code}${base.gross_amount}test-server-key-12345`;
  const signature_key = createHash("sha512").update(raw).digest("hex");

  return { ...base, signature_key } as MidtransNotification;
}

// ─── verifyMidtransSignature ──

describe("verifyMidtransSignature", () => {
  it("returns true for a correctly signed notification", () => {
    const notification = buildValidNotification();
    expect(verifyMidtransSignature(notification)).toBe(true);
  });

  it("returns false when signature_key is wrong", () => {
    const notification = buildValidNotification();
    // Tamper with the signature — attacker trying to fake a payment
    const tampered = {
      ...notification,
      signature_key: "fake-signature-abc123",
    };
    expect(verifyMidtransSignature(tampered)).toBe(false);
  });

  it("returns false when order_id is tampered after signing", () => {
    const notification = buildValidNotification();
    // Signature was computed for STARTER but attacker changed it to PRO
    const tampered = {
      ...notification,
      order_id: "KUNDESK-org_3DZH-PRO-1234567890",
    };
    expect(verifyMidtransSignature(tampered)).toBe(false);
  });

  it("returns false when gross_amount is tampered after signing", () => {
    const notification = buildValidNotification();
    // Signature was for 149000 but attacker changed to 1 (pay less)
    const tampered = { ...notification, gross_amount: "1" };
    expect(verifyMidtransSignature(tampered)).toBe(false);
  });

  it("returns false when status_code is tampered after signing", () => {
    const notification = buildValidNotification();
    const tampered = { ...notification, status_code: "201" };
    expect(verifyMidtransSignature(tampered)).toBe(false);
  });

  it("returns false when midtransServerKey is missing", async () => {
    // Temporarily override env to simulate missing server key
    const { env } = await import("@/lib/env");
    const original = env.midtransServerKey;

    // @ts-expect-error — intentionally mutating for test
    env.midtransServerKey = undefined;

    const notification = buildValidNotification();
    expect(verifyMidtransSignature(notification)).toBe(false);

    // Restore
    // @ts-expect-error — restoring after test
    env.midtransServerKey = original;
  });

  it("is sensitive to field order in the hash — order_id must come first", () => {
    // If someone accidentally reorders the concatenation, this fails
    // Proves we're computing SHA512(order_id + status_code + gross_amount + key)
    // not some other order
    const notification = buildValidNotification();

    // Manually compute with wrong field order — should NOT match
    const wrongOrder = `test-server-key-12345${notification.order_id}${notification.status_code}${notification.gross_amount}`;
    const wrongSignature = createHash("sha512")
      .update(wrongOrder)
      .digest("hex");

    const tampered = { ...notification, signature_key: wrongSignature };
    expect(verifyMidtransSignature(tampered)).toBe(false);
  });

  it("produces different signatures for different plans — no collision", () => {
    // Ensures STARTER and PRO notifications can never share a valid signature
    const starterNotification = buildValidNotification({
      order_id: "KUNDESK-org_3DZH-STARTER-1234567890",
      gross_amount: "149000",
    });

    const proNotification = buildValidNotification({
      order_id: "KUNDESK-org_3DZH-PRO-1234567890",
      gross_amount: "399000",
    });

    // Each notification's signature only validates for itself
    expect(verifyMidtransSignature(starterNotification)).toBe(true);
    expect(verifyMidtransSignature(proNotification)).toBe(true);

    // Cross-validation must fail — signatures are not interchangeable
    const crossTampered = {
      ...starterNotification,
      signature_key: proNotification.signature_key,
    };
    expect(verifyMidtransSignature(crossTampered)).toBe(false);
  });
});

// ─── generateOrderId ──

describe("generateOrderId", () => {
  beforeEach(() => {
    // Pin Date.now() so the timestamp in the order_id is deterministic
    vi.spyOn(Date, "now").mockReturnValue(1234567890000);
  });

  it("starts with KUNDESK prefix", () => {
    const orderId = generateOrderId("org_3DZHfake123", "starter");
    expect(orderId.startsWith("KUNDESK-")).toBe(true);
  });

  it("includes the first 8 chars of orgId", () => {
    const orderId = generateOrderId("org_3DZHfake123", "starter");
    // org_3DZH = first 8 chars of "org_3DZHfake123"
    expect(orderId).toContain("org_3DZH");
  });

  it("includes plan name in uppercase", () => {
    const starterOrderId = generateOrderId("org_3DZHfake123", "starter");
    const proOrderId = generateOrderId("org_3DZHfake123", "pro");

    expect(starterOrderId).toContain("STARTER");
    expect(proOrderId).toContain("PRO");
  });

  it("ends with a timestamp", () => {
    const orderId = generateOrderId("org_3DZHfake123", "starter");
    // With Date.now() pinned to 1234567890000
    expect(orderId.endsWith("1234567890000")).toBe(true);
  });

  it("produces the exact expected format", () => {
    const orderId = generateOrderId("org_3DZHfake123", "starter");
    expect(orderId).toBe("KUNDESK-org_3DZH-STARTER-1234567890000");
  });

  it("has at least 4 parts when split by dash — matches webhook parser", () => {
    // The webhook handler does order_id.split("-") and checks parts.length >= 4
    // This test ensures generateOrderId always produces parseable output
    const orderId = generateOrderId("org_3DZHfake123", "pro");
    const parts = orderId.split("-");
    expect(parts.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── cancelMidtransPayment ──
// fetch is stubbed — no real Midtrans calls

describe("cancelMidtransPayment", () => {
  const ORDER_ID = "KUNDESK-org_3DZH-STARTER-1234567890";
  const TOKEN = "1661df7b-28ca-45d9-88d3-fe9d2ae5b8ac";
  const URL_OK = `https://app.sandbox.midtrans.com/snap/v4/redirection/${TOKEN}`;
  const fetchMock = vi.fn();

  // Small helper: a fake fetch Response with a JSON body
  function res(status: number, body: object): Response {
    return new Response(JSON.stringify(body), { status });
  }

  beforeEach(() => {
    fetchMock.mockReset();
    mockEnv.paymentMode = "midtrans";
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    // Put everything back so other tests in this file are unaffected
    mockEnv.paymentMode = "mock";
    vi.unstubAllGlobals();
  });

  it("returns true in mock mode without calling Midtrans", async () => {
    mockEnv.paymentMode = "mock";
    expect(await cancelMidtransPayment(ORDER_ID, URL_OK)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels the Snap session with the token from the URL", async () => {
    fetchMock.mockResolvedValueOnce(res(200, {}));

    expect(await cancelMidtransPayment(ORDER_ID, URL_OK)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toContain(
      `/snap/v1/transactions/${TOKEN}/cancel`,
    );
  });

  it("falls back to cancelling the payment when the session cancel fails", async () => {
    fetchMock
      .mockResolvedValueOnce(res(409, {})) // session: transaction in progress
      .mockResolvedValueOnce(res(200, { status_code: "200" })); // payment cancelled

    expect(await cancelMidtransPayment(ORDER_ID, URL_OK)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toContain(`/v2/${ORDER_ID}/cancel`);
  });

  it("falls back when the session request throws (network error)", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(res(200, { status_code: "200" }));

    expect(await cancelMidtransPayment(ORDER_ID, URL_OK)).toBe(true);
  });

  it("returns true when Midtrans knows nothing about the order (404)", async () => {
    fetchMock
      .mockResolvedValueOnce(res(404, {}))
      .mockResolvedValueOnce(res(200, { status_code: "404" }));

    expect(await cancelMidtransPayment(ORDER_ID, URL_OK)).toBe(true);
  });

  it("returns false when Midtrans refuses to cancel (e.g. 412)", async () => {
    fetchMock
      .mockResolvedValueOnce(res(409, {}))
      .mockResolvedValueOnce(res(200, { status_code: "412" }));

    expect(await cancelMidtransPayment(ORDER_ID, URL_OK)).toBe(false);
  });

  it("skips the session step when the URL has no token", async () => {
    fetchMock.mockResolvedValueOnce(res(200, { status_code: "200" }));

    expect(await cancelMidtransPayment(ORDER_ID, "not-a-url")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toContain("/v2/");
  });
});
