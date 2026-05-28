// Tests the billing flow — plan upgrade via mock Midtrans webhook
// Verifies: billing page loads, plan cards render, webhook activates subscription,
// dashboard reflects updated plan, payment history appears

import { createHash } from "crypto";
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

// Build a valid Midtrans notification — same formula as verifyMidtransSignature()
function buildMidtransNotification(
  orderId: string,
  serverKey: string,
  plan: "starter" | "pro",
) {
  const grossAmount = plan === "starter" ? "149000" : "399000";
  const statusCode = "200";
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const signatureKey = createHash("sha512").update(raw).digest("hex");

  return {
    order_id: orderId,
    transaction_status: "settlement",
    fraud_status: "accept",
    gross_amount: grossAmount,
    payment_type: "bank_transfer",
    transaction_id: `mock-txn-${Date.now()}`,
    status_code: statusCode,
    signature_key: signatureKey,
  };
}

test.describe("Billing", () => {
  test("billing page loads with plan cards", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard/billing");
    await page.waitForURL(/\/dashboard\/billing/, { timeout: 15_000 });

    // All 3 plan cards must be visible — scope to plan label spans inside cards
    // getByText is strict by default — .first() resolves the duplicate match
    await expect(
      page.locator("span.uppercase", { hasText: "Free" }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.locator("span.uppercase", { hasText: "Starter" }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.locator("span.uppercase", { hasText: "Pro" }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows current plan status", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard/billing");
    await page.waitForURL(/\/dashboard\/billing/, { timeout: 15_000 });

    // Current plan card heading must be visible
    await expect(page.getByText("Plan Saat Ini")).toBeVisible({
      timeout: 10_000,
    });

    // "Kuota Pesan" label is always visible — proves CurrentPlanCard rendered
    await expect(page.getByText("Kuota Pesan")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("activates subscription via mock webhook and reflects on billing page", async ({
    page,
    request,
  }) => {
    await setupClerkTestingToken({ page });

    // Build a valid order_id — format: KUNDESK-{orgSlice}-{PLAN}-{timestamp}
    // orgSlice is first 8 chars of orgId
    const orgId = process.env.E2E_ORG_ID!;
    const orgSlice = orgId.slice(0, 8);
    const orderId = `KUNDESK-${orgSlice}-STARTER-${Date.now()}`;
    const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "mock-server-key";

    // Build notification with valid signature
    const notification = buildMidtransNotification(
      orderId,
      serverKey,
      "starter",
    );

    // Fire the webhook directly — same as what Midtrans would POST
    const webhookRes = await request.post(
      "http://localhost:3000/api/webhooks/midtrans",
      {
        data: notification,
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(webhookRes.ok()).toBe(true);
    const body = (await webhookRes.json()) as { message: string };
    expect(body.message).toBe("OK");

    // Navigate to billing — subscription should now show as active
    await page.goto("/dashboard/billing");
    await page.waitForURL(/\/dashboard\/billing/, { timeout: 15_000 });

    // Plan should now show Starter as active
    await expect(page.getByText("Aktif").first()).toBeVisible({
      timeout: 10_000,
    });

    // Payment history should have at least one entry
    await expect(
      page.getByRole("table", { name: "Riwayat pembayaran" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("rejects webhook with invalid signature", async ({ request }) => {
    const notification = {
      order_id: "KUNDESK-fake-STARTER-123",
      transaction_status: "settlement",
      fraud_status: "accept",
      gross_amount: "149000",
      payment_type: "bank_transfer",
      transaction_id: "fake-txn",
      status_code: "200",
      // Wrong signature — should be rejected
      signature_key: "invalidsignature",
    };

    const res = await request.post(
      "http://localhost:3000/api/webhooks/midtrans",
      {
        data: notification,
        headers: { "Content-Type": "application/json" },
      },
    );

    // 401 — signature mismatch
    expect(res.status()).toBe(401);
  });
});
