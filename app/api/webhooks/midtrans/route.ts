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

// ⚠️ Webhook handler: the ONLY place the subscription state machine advances.
// Defends with 4 layers BEFORE processing: signature → idempotency → status → fraud.
// This is necessary because webhooks are inherently risky:
//   - No OAuth/bearer token auth (Midtrans authenticates via signature)
//   - Retried automatically by Midtrans on any non-2xx response
//   - Received by an external party we don't control (Midtrans)
// Each layer is critical. Removing any one is a security regression.
// Processing order: verify → deduplicate → validate status → check fraud → parse → activate.

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

  // ⚠️ Critical: Idempotency guard via processedWebhooks table.
  // Midtrans retries ALL webhooks if we return non-2xx. Example scenario:
  //   1. Notification arrives, signature verified, we start processing
  //   2. activateSubscription succeeds, messagesLimit bumps from 100 → 1000
  //   3. markPaymentSuccess fails (timeout)
  //   4. We return 500 to Midtrans
  //   5. Midtrans retries 30 seconds later
  //   6. Without idempotency check, we activate AGAIN: messagesLimit bumps to 1000 twice
  //
  // Solution: check processedWebhooks EARLY, before activating anything.
  // If already processed, return 200 (Midtrans stops retrying immediately).
  // The (orderId, "midtrans") pair is unique — Midtrans never sends the same
  // order_id twice in the same webhook (but retries send it multiple times).
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
    // Return 200 immediately — Midtrans stops retrying on 2xx
    // This is safe to skip: activateSubscription is idempotent (SET, not INSERT)
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

  // ⚠️ Fraud check: Midtrans may flag payments as high-risk even after settlement.
  // fraud_status can be:
  //   - "accept" = legitimate, safe to activate
  //   - "challenge" = Midtrans is unsure, needs investigation
  //   - "deny" = Midtrans blocked it as fraud
  // We MUST NOT activate if fraud is flagged — even if transaction_status=settlement.
  // This prevents accepting stolen cards or fraudulent transfers.
  // Mark processed (to stop retries) but DON'T activate — flag for manual review.
  const isFraudulent = fraud_status === "challenge" || fraud_status === "deny";

  if (isFraudulent) {
    console.error("[midtrans webhook] FRAUD FLAG — manual review required", {
      order_id,
      fraud_status,
      payment_type,
    });
    // Mark processed so Midtrans stops retrying this notification
    await db.insert(processedWebhooks).values({
      externalId: order_id,
      source: "midtrans",
    });
    // Return 200 — webhook is "handled", just not activated
    // Support team will see the payment in the payment_history with status=pending
    // and can investigate and either manually activate or refund
    return NextResponse.json(
      { message: "Flagged for review" },
      { status: 200 },
    );
  }

  // ⚠️ Order ID is a serialized transaction record.
  // All context needed to process the webhook is embedded here — no extra DB lookup needed.
  // Format: KUNDESK-{orgSlice}-{PLAN}-{timestamp}[-P{promoId}]
  //   Example no promo: KUNDESK-org_3DZH-STARTER-1704067200000
  //   Example with promo: KUNDESK-org_3DZH-STARTER-1704067200000-P42
  //
  // Why promo ID is encoded: Midtrans webhook only tells us the order_id.
  // To know which promo to increment usedCount for, we encode the ID at checkout time.
  // This avoids a costly DB lookup inside the webhook handler.
  const parts = order_id.split("-");

  if (parts.length < 4) {
    console.error("[midtrans webhook] Malformed order_id", { order_id });
    return NextResponse.json({ error: "Malformed order_id" }, { status: 400 });
  }

  const orgIdSlice = parts[1] as string;
  const planRaw = (parts[2] as string).toLowerCase();

  // Extract promo ID from optional suffix using regex.
  // Suffix format: -P{digits}. Example: -P42, -P100.
  // .find() scans parts for one matching /^P\d+$/ — safe pattern, no injection risk.
  // If found, parseInt removes the "P" prefix to get the numeric ID.
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

  // ⚠️ Org lookup by LEFT(orgId, 8) — clever but dangerous without validation.
  // Why prefix lookup? Embedding the full Clerk orgId (e.g. "org_abc123xyz456") in
  // the order_id makes it too long. Instead, we take the first 8 chars: "org_abc1".
  // On webhook, we reverse: search for any org whose ID starts with those 8 chars.
  //
  // Risk: if two orgs happen to have the same 8-char prefix (astronomically unlikely
  // with Clerk's random generation, but possible), we'd ambiguously match both.
  // Solution: check matchingOrgs.length === 1. If not, return 200 (don't activate).
  // Midtrans will see 200, stop retrying, but no org is activated. Support team
  // sees a "mystery payment" in order history and investigates.
  const matchingOrgs = await db
    .select({ id: orgs.id, name: orgs.name, ownerEmail: orgs.ownerEmail })
    .from(orgs)
    .where(sql`LEFT(${orgs.id}, 8) = ${orgIdSlice}`);

  if (matchingOrgs.length !== 1) {
    console.error("[midtrans webhook] Org resolution failed", {
      order_id,
      orgIdSlice,
      matches: matchingOrgs.length,
    });
    // Return 200 — webhook is "handled" (we attempted), just couldn't process
    // If 0 matches: org doesn't exist (checkout used deleted org?)
    // If 2+ matches: prefix collision (should never happen, but we're safe)
    return NextResponse.json(
      { error: "Org resolution failed" },
      { status: 200 },
    );
  }

  const org = matchingOrgs[0]!;

  // ⚠️ CRITICAL ORDERING: processedWebhooks insert is INSIDE the transaction.
  // Why? If we insert outside, Midtrans sees 200 and stops retrying — even if the
  // transaction rolls back. Example bad sequence:
  //   1. Inside tx: activateSubscription succeeds (SET orgs.plan = 'pro')
  //   2. Inside tx: markPaymentSuccess succeeds (UPDATE payments table)
  //   3. Inside tx: promoCode increment succeeds
  //   4. OUTSIDE tx: processedWebhooks insert succeeds
  //   5. tx rolls back (connection timeout, constraint violation, etc.)
  //   6. Org is back to free, payment never recorded, BUT processedWebhooks shows processed
  //   7. Midtrans sees 200, stops retrying — webhook is lost forever
  //
  // Solution: insert processedWebhooks INSIDE transaction. On rollback, it's
  // rolled back too. Midtrans retries. Next attempt tries again from scratch.
  // Only when the ENTIRE transaction succeeds do we mark it as processed.
  //
  // activateSubscription is idempotent (SET, not INSERT) — safe to call multiple times.
  // markPaymentSuccess updates the payment row by orderId — also safe to retry.
  // promoCode increment is inside tx — rolled back on failure.
  let periodEnd!: Date;

  await db.transaction(async (tx) => {
    const result = await activateSubscription(org.id, plan, payment_type);
    periodEnd = result.periodEnd;

    await markPaymentSuccess(
      org.id,
      order_id,
      plan,
      parseInt(notification.gross_amount, 10),
      payment_type,
    );

    if (promoId !== null) {
      // Increment promo usedCount atomically — inside tx so it rolls back on failure
      await tx
        .update(promoCodes)
        .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
        .where(eq(promoCodes.id, promoId));
    }

    // Mark processed INSIDE transaction — if tx rolls back, this rolls back too.
    // Idempotency is guaranteed: only when all state changes succeed is the
    // webhook marked processed. Midtrans will retry if we don't return 200.
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

  // ⚠️ Async pattern: dashboard notification MUST be awaited, email/analytics can fire-and-forget.
  // Why?
  //   - createNotification: owner sees the bell instantly, blocks webhook return. If this fails,
  //     we've already activated the subscription (tx committed), so rollback is impossible.
  //     Better to retry createNotification than silently lose the notification.
  //   - sendPlanUpgradedEmail: nice-to-have, doesn't affect core state. Retry in background.
  //   - trackEventImmediate: analytics are mission-critical for product metrics, so we await.
  //
  // Rationale: webhook must return 200 to Midtrans within ~15 seconds (varies by platform).
  // We've already done the hard work (activated subscription, recorded payment). At this point,
  // email delays and analytics can safely be async without blocking the 200 response.
  const planLabel = plan === "pro" ? "Pro" : "Starter";

  // Notification MUST succeed — owner needs to see the bell immediately on dashboard
  await createNotification(
    org.id,
    "plan_upgraded",
    `Plan berhasil diupgrade ke ${planLabel}`,
    `Pembayaran dikonfirmasi · ${order_id}`,
  ).catch(console.error);

  // Email is fire-and-forget — doesn't block webhook response
  // If it fails, the error is logged and swallowed. Owner still has activated subscription.
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

  // Analytics: await so we're sure the event is recorded before returning
  // Product metrics depend on this — don't lose events to async failures
  await trackEventImmediate(org.id, "plan_upgraded", {
    plan,
    payment_type,
    has_promo: promoId !== null,
  });

  return NextResponse.json({ message: "OK" }, { status: 200 });
}
