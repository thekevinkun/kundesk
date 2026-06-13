// Midtrans payment notification handler
// Midtrans POSTs here after every payment event — settlement, pending, expire, etc.
// This handler is the ONLY place that advances the subscription state machine
// Security: signature verification + idempotency check + fraud check

import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { trackEventImmediate } from "@/lib/posthog";
import { verifyMidtransSignature } from "@/lib/midtrans";
import { sendPlanUpgradedEmail } from "@/lib/email";
import { createNotification } from "@/lib/db/queries/dashboard";
import { orgs, processedWebhooks, promoCodes } from "@/lib/db/schema";
import {
  activateSubscription,
  markPaymentSuccess,
  markPaymentClosed,
} from "@/lib/db/queries/billing";
import type { MidtransNotification, PlanName } from "@/types/billing";

// Midtrans sends POST — no auth header, verified via signature instead
export async function POST(req: NextRequest): Promise<NextResponse> {
  let notification: MidtransNotification;

  // Parse notification body — malformed JSON returns 400
  try {
    notification = (await req.json()) as MidtransNotification;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Layer 1: Signature verification ──
  // SHA512(order_id + status_code + gross_amount + server_key)
  // Reject immediately if mismatch — don't process anything
  const signatureValid = verifyMidtransSignature(notification);
  if (!signatureValid) {
    console.warn("[midtrans webhook] Invalid signature — rejected", {
      order_id: notification.order_id,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { order_id, transaction_status, fraud_status, payment_type } =
    notification;

  // ── Layer 2: Idempotency check ──
  // Midtrans retries notifications — processedWebhooks prevents double-processing
  const [alreadyProcessed] = await db
    .select({ id: processedWebhooks.id })
    .from(processedWebhooks)
    .where(
      and(
        eq(processedWebhooks.source, "midtrans"),
        eq(processedWebhooks.externalId, order_id),
      ),
    );

  if (alreadyProcessed) {
    // Return 200 — Midtrans stops retrying on 2xx
    console.log("[midtrans webhook] Already processed — skipping", {
      order_id,
    });
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  // ── Layer 3: Transaction status check ──
  // "settlement" = bank transfer/e-wallet paid
  // "capture" = credit card authorized and captured
  const isSettled =
    transaction_status === "settlement" || transaction_status === "capture";

  if (!isSettled) {
    // expire/cancel/deny → close out the pending payment row so it stops
    // showing on /billing as "resume payment" and history reflects the outcome
    if (
      transaction_status === "expire" ||
      transaction_status === "cancel" ||
      transaction_status === "deny"
    ) {
      const closedStatus =
        transaction_status === "expire" ? "expired" : "failed";

      await markPaymentClosed(order_id, closedStatus).catch(console.error);

      // Mark processed so Midtrans stops retrying this notification
      await db
        .insert(processedWebhooks)
        .values({ externalId: order_id, source: "midtrans" })
        .catch(() => {
          // Unique constraint violation on retry — already marked processed, ignore
        });

      console.log("[midtrans webhook] Payment closed", {
        order_id,
        transaction_status,
        closedStatus,
      });

      return NextResponse.json({ message: "Payment closed" }, { status: 200 });
    }

    // "pending" status — VA created but not yet paid, no action needed
    console.log("[midtrans webhook] Non-settlement status — no action", {
      order_id,
      transaction_status,
    });
    return NextResponse.json(
      { message: "No action required" },
      { status: 200 },
    );
  }

  // ── Layer 4: Fraud check ──
  // "challenge" or "deny" = flagged by Midtrans fraud detection
  // Do NOT activate — mark as processed to stop retries, log for manual review
  const isFraudulent = fraud_status === "challenge" || fraud_status === "deny";

  if (isFraudulent) {
    console.error("[midtrans webhook] FRAUD FLAG — manual review required", {
      order_id,
      fraud_status,
    });
    // Mark processed so Midtrans stops retrying
    await db.insert(processedWebhooks).values({
      externalId: order_id,
      source: "midtrans",
    });
    return NextResponse.json(
      { message: "Flagged for review" },
      { status: 200 },
    );
  }

  // ── Layer 5: Parse order_id ──
  // Format: KUNDESK-{orgId.slice(0,8)}-{PLAN}-{timestamp}
  // Example: KUNDESK-org_3DZH-STARTER-1234567890
  const parts = order_id.split("-");

  // Need at least 4 parts: KUNDESK, orgSlice, PLAN, timestamp
  if (parts.length < 4) {
    console.error("[midtrans webhook] Malformed order_id", { order_id });
    return NextResponse.json({ error: "Malformed order_id" }, { status: 400 });
  }

  // TypeScript doesn't narrow array access — assert after length check
  const orgIdSlice = parts[1] as string;
  const planRaw = (parts[2] as string).toLowerCase();

  // Parse optional promo ID from order suffix — format: ...-P{promoId}
  // e.g. KUNDESK-org_3DZH-STARTER-1234567890-P42 → promoId = 42
  const promoSuffix = parts.find((p) => p.startsWith("P") && /^P\d+$/.test(p));
  const promoId = promoSuffix ? parseInt(promoSuffix.slice(1), 10) : null;

  if (planRaw !== "starter" && planRaw !== "pro") {
    console.error("[midtrans webhook] Unknown plan in order_id", {
      order_id,
      planRaw,
    });
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const plan = planRaw as PlanName;

  // ── Layer 6: Look up org by id prefix ──
  // orgId slice is first 8 chars of Clerk orgId — e.g. "org_3DZH"
  // Widened to include name + ownerEmail — used for the upgrade confirmation email
  const matchingOrgs = await db
    .select({ id: orgs.id, name: orgs.name, ownerEmail: orgs.ownerEmail })
    .from(orgs)
    .where(sql`LEFT(${orgs.id}, 8) = ${orgIdSlice}`);

  if (matchingOrgs.length !== 1) {
    console.error("[midtrans webhook] Org not found for order_id", {
      order_id,
      orgIdSlice,
      matches: matchingOrgs.length,
    });
    return NextResponse.json(
      { error: "Org resolution ambiguous" },
      { status: 200 },
    );
  }

  const org = matchingOrgs[0]!;

  // ── Layer 7: Activate subscription + mark payment success ──
  // Both run before marking processed — if either throws, Midtrans retries
  // activateSubscription is idempotent (SET) — safe to retry
  // markPaymentSuccess updates the pending row created at checkout (by orderId)
  let periodEnd!: Date;

  await db.transaction(async (tx) => {
    const result = await activateSubscription(
      org.id,
      plan,
      payment_type /*, tx */,
    );
    periodEnd = result.periodEnd;

    await markPaymentSuccess(order_id, payment_type /*, tx */);

    if (promoId !== null) {
      await tx
        .update(promoCodes)
        .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
        .where(eq(promoCodes.id, promoId));
    }

    await tx.insert(processedWebhooks).values({
      externalId: order_id,
      source: "midtrans",
    });
  });

  console.log("[midtrans webhook] Subscription activated", {
    orgId: org.id,
    plan,
    order_id,
  });

  // Notify dashboard — owner sees confirmation of their upgrade immediately
  const planLabel = plan === "pro" ? "Pro" : "Starter";

  // Await before returning 200 — Midtrans won't retry on 2xx, so if we
  // fire-and-forget here and the insert fails, the notification is permanently lost
  await createNotification(
    org.id,
    "plan_upgraded",
    `Plan berhasil diupgrade ke ${planLabel}`,
    `Pembayaran dikonfirmasi · ${order_id}`,
  ).catch(console.error);

  // Send receipt/confirmation email — fire-and-forget, doesn't block webhook response
  sendPlanUpgradedEmail(
    org.ownerEmail ?? "",
    org.name,
    plan,
    parseInt(notification.gross_amount, 10),
    payment_type,
    order_id,
    new Date(),
    periodEnd,
    env.logoUrl,
  ).catch((err) =>
    console.error("[midtrans webhook] Failed to send upgrade email:", err),
  );

  // Track plan upgrades — wait for delivery before ending the webhook response.
  await trackEventImmediate(org.id, "plan_upgraded", {
    plan,
    payment_type,
    has_promo: promoId !== null,
  });

  return NextResponse.json({ message: "OK" }, { status: 200 });
}
