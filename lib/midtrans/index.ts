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

// Formats a Date into the exact format Midtrans's expiry.start_time requires:
// "yyyy-MM-dd HH:mm:ss Z" — e.g. "2026-09-12 14:30:00 +0700"
// Using WIB (Asia/Jakarta) — matches the timezone convention already used
// elsewhere in the codebase (lib/ai/rag.ts's date injection).
function formatMidtransExpiryStartTime(date: Date): string {
  const wib = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = wib.getFullYear();
  const m = pad(wib.getMonth() + 1);
  const d = pad(wib.getDate());
  const h = pad(wib.getHours());
  const min = pad(wib.getMinutes());
  const s = pad(wib.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s} +0700`;
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
      // Expire the Snap transaction at exactly the same 24h cutoff our own
      // payments table uses (insertPendingPayment's stale-row expiry,
      // getPendingPayment's resume-banner window). Without this, Midtrans
      // defaults to a longer window, so a customer could settle a payment
      // after our local row was already marked "expired" — the scenario
      // CodeRabbit flagged. Structurally closing it here is safer than
      // reconciling two independent 24h clocks after the fact.
      expiry: {
        start_time: formatMidtransExpiryStartTime(new Date()),
        unit: "hours",
        duration: 24,
      },
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

// Pulls the Snap token out of a stored redirect URL.
// Redirect URL looks like .../snap/v4/redirection/{token} — token is a UUID.
// Returns null if the URL has no UUID at the end (then we skip the session step).
function extractSnapToken(redirectUrl: string): string | null {
  try {
    const last = new URL(redirectUrl).pathname.split("/").filter(Boolean).pop();
    return last && /^[0-9a-f-]{36}$/i.test(last) ? last : null;
  } catch {
    return null; // Malformed URL — nothing to extract
  }
}

// Closes a pending payment on Midtrans's side, so an old link/QR/VA can't be paid
// after the owner clicked "Batalkan".
// Returns true  → safe to mark the payment cancelled in our DB
// Returns false → Midtrans refused (e.g. payment is being processed) — do NOT cancel locally
export async function cancelMidtransPayment(
  orderId: string,
  redirectUrl: string,
): Promise<boolean> {
  // Mock mode: nothing exists at Midtrans, so there is nothing to close
  if (env.paymentMode === "mock") return true;

  if (!env.midtransServerKey) {
    throw new Error(
      "Midtrans credentials required when KUNDESK_PAYMENT_MODE=midtrans",
    );
  }

  const authHeader = Buffer.from(`${env.midtransServerKey}:`).toString(
    "base64",
  );
  const headers = {
    Authorization: `Basic ${authHeader}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const snapBase = env.midtransProduction
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";
  const coreBase = env.midtransProduction
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";

  // Step 1 — cancel the Snap page. Works when the customer has NOT picked a method yet.
  // Any failure here (already in progress, token unknown, network) just moves on to step 2.
  // 4s timeout each: Vercel free functions stop at 10s and we may make two calls.
  const token = extractSnapToken(redirectUrl);
  if (token) {
    try {
      const res = await fetch(`${snapBase}/transactions/${token}/cancel`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn("[cancelMidtransPayment] Snap session cancel failed", err);
    }
  }

  // Step 2 — cancel the payment itself. Works when the customer already picked
  // QRIS / VA / GoPay and a pending payment exists.
  // Core API can answer HTTP 200 with the real result inside body.status_code,
  // so we read the body first and fall back to the HTTP status.
  const res = await fetch(`${coreBase}/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(4000),
  });
  const body = (await res.json().catch(() => null)) as {
    status_code?: string;
  } | null;
  const code = body?.status_code ?? String(res.status);

  if (code === "200") return true; // Payment cancelled

  if (code === "404") {
    // Midtrans knows no payment for this order and step 1 found no live page.
    // Nothing left to close, so cancelling locally is safe. Logged in case the
    // token parsing is wrong (the page would still be alive).
    console.warn("[cancelMidtransPayment] Nothing to cancel at Midtrans", {
      orderId,
    });
    return true;
  }

  // Anything else (e.g. already settled / cannot be changed): refuse
  console.error("[cancelMidtransPayment] Midtrans refused cancel", {
    orderId,
    code,
  });
  return false;
}
