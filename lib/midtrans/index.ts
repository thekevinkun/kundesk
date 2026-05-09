// Midtrans payment gateway — Indonesian payment methods
// Mock mode fires a fake webhook notification — state machine still runs
// Real mode creates actual Midtrans transactions

import { env } from "@/lib/env"
import { createHash } from "crypto"
import type { MidtransNotification, PlanName } from "@/types/billing"
import { PLAN_PRICE } from "@/types/billing"

// Verifies Midtrans webhook signature — reject if mismatch
// Signature = SHA512(order_id + status_code + gross_amount + server_key)
export function verifyMidtransSignature(
  notification: MidtransNotification
): boolean {
  if (!env.midtransServerKey) return false

  const raw = `${notification.order_id}${notification.status_code}${notification.gross_amount}${env.midtransServerKey}`
  const expected = createHash("sha512").update(raw).digest("hex")

  return expected === notification.signature_key
}

// Generates a unique order ID for a subscription payment
export function generateOrderId(orgId: string, plan: PlanName): string {
  const timestamp = Date.now()
  return `KUNDESK-${orgId.slice(0, 8)}-${plan.toUpperCase()}-${timestamp}`
}

// Creates a Midtrans transaction for a plan subscription
export async function createSubscriptionTransaction(
  orgId: string,
  plan: PlanName,
  customerEmail: string
): Promise<{ token: string; redirectUrl: string; orderId: string }> {
  const orderId = generateOrderId(orgId, plan)
  const amount = PLAN_PRICE[plan]

  // Mock mode — return fake token, no real transaction created
  if (env.paymentMode === "mock") {
    return {
      token:       `mock-token-${orderId}`,
      redirectUrl: `${env.appUrl}/billing/mock-payment?order_id=${orderId}`,
      orderId,
    }
  }

  // Real mode — create Midtrans Snap transaction
  if (!env.midtransServerKey || !env.midtransClientKey) {
    throw new Error("Midtrans credentials required when KUNDESK_PAYMENT_MODE=midtrans")
  }

  const baseUrl = env.midtransProduction
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1"

  const authHeader = Buffer.from(`${env.midtransServerKey}:`).toString("base64")

  const response = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction_details: {
        order_id:     orderId,
        gross_amount: amount,
      },
      customer_details: {
        email: customerEmail,
      },
      // Push VA/Bank Transfer as default — lowest fee (Rp 4.000 flat)
      enabled_payments: [
        "bank_transfer", "gopay", "qris", "ovo", "dana",
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Midtrans transaction error: ${response.statusText}`)
  }

  const data = await response.json() as { token: string; redirect_url: string }

  return {
    token:       data.token,
    redirectUrl: data.redirect_url,
    orderId,
  }
}

// Fires a mock Midtrans webhook notification — used in mock mode for testing
export async function fireMockWebhook(
  orderId: string,
  orgId: string,
  plan: PlanName
): Promise<void> {
  const amount = PLAN_PRICE[plan].toString()

  // Build a fake notification matching Midtrans structure exactly
  const notification: Omit<MidtransNotification, "signature_key"> = {
    order_id:           orderId,
    transaction_status: "settlement",
    fraud_status:       "accept",
    gross_amount:       amount,
    payment_type:       "bank_transfer",
    transaction_id:     `mock-txn-${Date.now()}`,
    status_code:        "200",
  }

  // Generate a valid signature so our webhook handler accepts it
  const raw = `${notification.order_id}${notification.status_code}${notification.gross_amount}${env.midtransServerKey ?? "mock-server-key"}`
  const signature_key = createHash("sha512").update(raw).digest("hex")

  // POST to our own webhook handler
  await fetch(`${env.appUrl}/api/webhooks/midtrans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...notification, signature_key }),
  })
}
