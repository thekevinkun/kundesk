// Midtrans payment gateway — Indonesian payment methods
// Mock mode fires a fake webhook notification — state machine still runs
// Real mode creates actual Midtrans transactions

import { env } from "@/lib/env";
import { createHash } from "crypto";
import type { MidtransNotification, PlanName } from "@/types/billing";
import { PLAN_PRICE } from "@/types/billing";

// ⚠️ Critical security: verify Midtrans webhook signature on EVERY notification.
// Signature = HMAC-SHA512(order_id + status_code + gross_amount + server_key).
// Why this matters:
//   1. Proves the webhook came from Midtrans, not an attacker
//   2. Prevents subscription fraud: attacker can't forge a "payment settled" webhook
//   3. Prevents double-processing: signature check is fast, done before state machine
// Midtrans retries failed webhooks, so signature verification + processedWebhooks
// table are both critical (defense in depth).
// See: /api/webhooks/midtrans for the full idempotency pattern.
export function verifyMidtransSignature(
  notification: MidtransNotification,
): boolean {
  if (!env.midtransServerKey) return false;

  // Signature is the HMAC of the concatenated payload + server key.
  // Order of concatenation is critical — must match Midtrans's exact formula.
  const raw = `${notification.order_id}${notification.status_code}${notification.gross_amount}${env.midtransServerKey}`;
  const expected = createHash("sha512").update(raw).digest("hex");

  return expected === notification.signature_key;
}

// ⚠️ Clever encoding: promo ID is baked into the order_id, not stored separately.
// Why? The webhook notification from Midtrans contains only order_id. To know
// which promo was used and increment its usedCount, we encode the promoId here.
//
// Format: KUNDESK-{orgSlice}-{PLAN}-{timestamp}-P{promoId}
//   Example: KUNDESK-abc12345-STARTER-1704067200000-P5
//   Example without promo: KUNDESK-abc12345-STARTER-1704067200000
//
// The webhook handler uses a regex to extract the promo ID on settlement:
//   const promoMatch = orderId.match(/-P(\d+)$/)
//   if (promoMatch) promoId = parseInt(promoMatch[1])
//
// Trade-off: order_id length is long, but parsing is O(1) and no extra DB lookup needed.
export function generateOrderId(
  orgId: string,
  plan: PlanName,
  promoId?: number,
): string {
  const timestamp = Date.now();
  const promoSuffix = promoId !== undefined ? `-P${promoId}` : "";
  return `KUNDESK-${orgId.slice(0, 8)}-${plan.toUpperCase()}-${timestamp}${promoSuffix}`;
}

// Creates a Midtrans transaction for a plan subscription
export async function createSubscriptionTransaction(
  orgId: string,
  plan: PlanName,
  customerEmail: string,
  amount: number,
  // Optional promo ID — encoded in order_id so webhook can increment usedCount on settlement
  promoId?: number,
): Promise<{ token: string; redirectUrl: string; orderId: string }> {
  const orderId = generateOrderId(orgId, plan, promoId);

  // ⚠️ Mock mode: return fake token without hitting Midtrans API.
  // This enables testing the entire payment → subscription flow without
  // spending money or waiting for Midtrans webhooks. The redirect to
  // /billing/mock-payment is a fake Midtrans checkout that fires our own
  // webhook immediately (via fireMockWebhook) so the state machine can be tested.
  // In production (KUNDESK_PAYMENT_MODE=midtrans), this branch never runs.
  if (env.paymentMode === "mock") {
    return {
      token: `mock-token-${orderId}`,
      redirectUrl: `${env.appUrl}/billing/mock-payment?order_id=${orderId}`,
      orderId,
    };
  }

  // Real mode — create Midtrans Snap transaction
  if (!env.midtransServerKey || !env.midtransClientKey) {
    throw new Error(
      "Midtrans credentials required when KUNDESK_PAYMENT_MODE=midtrans",
    );
  }

  const baseUrl = env.midtransProduction
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";

  const authHeader = Buffer.from(`${env.midtransServerKey}:`).toString(
    "base64",
  );

  const response = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        email: customerEmail,
      },
      // ⚠️ All three callbacks point to /billing (not separate success/error pages).
      // Why? Kundesk has no dedicated payment status pages. The /billing page itself
      // is the source of truth — it shows subscription status, payment history, and
      // handles Midtrans query params (order_id, status_code, transaction_status).
      // Midtrans redirects the customer's browser after payment with these query params.
      // The webhook runs async and updates the org independently — eventual consistency.
      // If the customer closes the browser before the webhook fires, the next page
      // load will see the updated subscription status (webhook finished in background).
      callbacks: {
        finish: `${env.appUrl}/dashboard/billing`, // payment succeeded
        error: `${env.appUrl}/dashboard/billing`, // customer canceled or payment failed
        pending: `${env.appUrl}/dashboard/billing`, // payment still pending (rare)
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Midtrans transaction error: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    token: string;
    redirect_url: string;
  };

  return {
    token: data.token,
    redirectUrl: data.redirect_url,
    orderId,
  };
}

// ⚠️ Testing tool: self-POST a fake Midtrans webhook to test the state machine.
// This is how mock mode actually tests subscriptions end-to-end without Midtrans API.
// Flow:
//   1. Test calls createSubscriptionTransaction(..., KUNDESK_PAYMENT_MODE=mock)
//   2. Test immediately calls fireMockWebhook with the same orderId
//   3. Webhook handler runs our idempotency check + state machine
//   4. org.subscriptionStatus becomes "active", nextBillingDate is set
// The signature is forged but valid (using env.midtransServerKey) so the webhook
// handler accepts it without suspicion. Renewal cron and E2E tests rely on this.
export async function fireMockWebhook(
  orderId: string,
  orgId: string,
  plan: PlanName,
  // Accept optional amount override — for testing discounted payments
  // Defaults to PLAN_PRICE[plan] for backward compatibility
  amount?: number,
): Promise<void> {
  const grossAmount = (amount ?? PLAN_PRICE[plan]).toString();

  // Build a fake notification matching Midtrans structure exactly
  // status: "settlement" = payment cleared (not "pending" or "deny")
  // fraud_status: "accept" = payment is legitimate (not "challenge" or "deny")
  const notification: Omit<MidtransNotification, "signature_key"> = {
    order_id: orderId,
    transaction_status: "settlement", // ← must be "settlement", not other statuses
    fraud_status: "accept", // ← must be "accept", not "challenge"
    gross_amount: grossAmount,
    payment_type: "bank_transfer",
    transaction_id: `mock-txn-${Date.now()}`,
    status_code: "200",
  };

  // Generate a valid HMAC-SHA512 signature using the server key.
  // This signature is critical — without it, the webhook handler rejects the notification.
  // Even in mock mode, we must pass this check (forged but valid).
  const raw = `${notification.order_id}${notification.status_code}${notification.gross_amount}${env.midtransServerKey ?? "mock-server-key"}`;
  const signature_key = createHash("sha512").update(raw).digest("hex");

  // Self-POST to our own webhook handler — no external HTTP call, fast and synchronous.
  // The handler will run idempotency check (processedWebhooks table),
  // activate subscription, set renewal date, fire notifications, send emails, etc.
  await fetch(`${env.appUrl}/api/webhooks/midtrans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...notification, signature_key }),
  });
}
