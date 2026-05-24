// Unit tests for lib/midtrans/index.ts
// Tests the actual cryptographic signature verification — not mocked
// Also covers order ID generation and format validation

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// ── Mock @/lib/env ──
// env.ts calls requireEnv() at module load — throws without real vars
vi.mock("@/lib/env", () => ({
  env: {
    midtransServerKey: "test-server-key-12345",
    midtransClientKey: "test-client-key-12345",
    midtransProduction: false,
    paymentMode: "mock",
    appUrl: "http://localhost:3000",
  },
}));

// ── Import after mocks ──
import { verifyMidtransSignature, generateOrderId } from "./index";
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
