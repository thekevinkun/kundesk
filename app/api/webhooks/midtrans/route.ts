// Midtrans payment notification handler
// Midtrans POSTs here after every payment event — settlement, pending, expire, etc.
// This handler is the ONLY place that advances the subscription state machine
// for live notifications (the reconcile cron recovers lost ones via the same settlePaidOrder).
// Security: signature verification + idempotency check + fraud check

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { verifyMidtransSignature } from "@/lib/midtrans";
import { processedWebhooks } from "@/lib/db/schema";
import { markPaymentClosed } from "@/lib/db/queries/billing";
import { settlePaidOrder } from "@/lib/billing/settle-payment";
import type { MidtransNotification } from "@/types/billing";

// ⚠️ Webhook handler. Defends in layers BEFORE processing:
// body shape → signature → idempotency → status → fraud → status_code → settlement.
// This is necessary because webhooks are inherently risky:
//   - No OAuth/bearer token auth (Midtrans authenticates via signature)
//   - Retried automatically by Midtrans on any non-2xx response
//   - Received from an external party we don't control (Midtrans)
// Each layer is critical. Removing any one is a security regression.

// Shape check for the incoming body — runs BEFORE any field is read.
// Values are only bounded here; the real content checks happen later.
const notificationSchema = z.object({
  order_id: z.string().min(1).max(100),
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().min(1).max(30),
  signature_key: z.string().min(1).max(200),
  transaction_status: z.string().min(1).max(30),
  payment_type: z.string().min(1).max(50),
  fraud_status: z.string().max(30).optional(), // absent on some payment types
});

// Midtrans sends POST — no auth header, verified via signature instead
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse the body as unknown first — nothing is trusted until the shape check passes
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Shape check — a body like `null` or missing fields is rejected before any field is read
  if (!notificationSchema.safeParse(rawBody).success) {
    console.warn("[midtrans webhook] Invalid payload shape — rejected");
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Shape is verified, so this cast is now safe
  const notification = rawBody as MidtransNotification;

  // ⚠️ Safety net: any unexpected error below (Neon cold start, dropped connection)
  // returns 503 so Midtrans retries. We must never answer 200 for a payment we failed to record.
  try {
    return await processNotification(notification);
  } catch (err) {
    console.error(
      "[midtrans webhook] Unexpected error — asking Midtrans to retry",
      { order_id: notification.order_id, err },
    );
    // Sentry only sees what we send it — report it explicitly
    Sentry.captureException(err, { extra: { orderId: notification.order_id } });
    return NextResponse.json(
      { error: "Temporary error — please retry" },
      { status: 503 },
    );
  }
}

// All the notification logic lives here. Anything it throws is caught by POST above.
async function processNotification(
  notification: MidtransNotification,
): Promise<NextResponse> {
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

  // ── Layer 2: Idempotency guard via processedWebhooks ──
  // Midtrans retries ALL webhooks if we return non-2xx. If this order already went
  // through settlement, answer 200 immediately so Midtrans stops retrying.
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
    // ⚠️ A declined attempt (deny) does NOT end the order — Snap lets the customer go
    // back to the list and try another method on the same order_id. Log only: the row
    // stays pending, and a later settlement can still activate.
    if (transaction_status === "deny") {
      console.log("[midtrans webhook] Attempt denied — order still open", {
        order_id,
      });
      return NextResponse.json(
        { message: "Attempt denied — no action" },
        { status: 200 },
      );
    }

    // expire/cancel → the order is really finished. Close the pending row so it stops
    // showing on /billing as "resume payment".
    if (transaction_status === "expire" || transaction_status === "cancel") {
      const closedStatus =
        transaction_status === "expire" ? "expired" : "failed";

      // No .catch here — if the DB is down we WANT the 503 so Midtrans retries
      await markPaymentClosed(order_id, closedStatus);

      // ⚠️ Deliberately NOT writing to processedWebhooks: answering 200 already stops
      // Midtrans retrying, and marking a non-payment event as "processed" is what
      // used to block a later successful payment on the same order.
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
  // Midtrans may flag payments as high-risk even after settlement:
  //   "accept" = legitimate, "challenge" = needs investigation, "deny" = blocked as fraud.
  // We MUST NOT activate if fraud is flagged. Mark processed (to stop retries) but
  // DON'T activate — flag for manual review.
  const isFraudulent = fraud_status === "challenge" || fraud_status === "deny";

  if (isFraudulent) {
    console.error("[midtrans webhook] FRAUD FLAG — manual review required", {
      order_id,
      fraud_status,
      payment_type,
    });

    // Explicit Sentry capture — this should page someone, not sit in Vercel logs.
    // orgId is not resolved at this point, so order_id is the correlation key.
    Sentry.captureMessage("midtrans webhook: fraud flag", {
      level: "error",
      extra: {
        orderId: order_id,
        fraudStatus: fraud_status,
        paymentType: payment_type,
      },
    });

    // Mark processed so Midtrans stops retrying this notification
    await db
      .insert(processedWebhooks)
      .values({ externalId: order_id, source: "midtrans" })
      .onConflictDoNothing();
    // Return 200 — webhook is "handled", just not activated
    return NextResponse.json(
      { message: "Flagged for review" },
      { status: 200 },
    );
  }

  // A real settlement/capture always carries status_code "200" (status_code is covered by the
  // signature, transaction_status is not). This runs AFTER the fraud check on purpose:
  // a card capture flagged "challenge" legitimately arrives with 201 and must hit the fraud branch.
  if (notification.status_code !== "200") {
    Sentry.captureMessage(
      "midtrans webhook: settlement with unexpected status_code",
      {
        level: "warning",
        extra: {
          orderId: order_id,
          statusCode: notification.status_code,
          transactionStatus: transaction_status,
        },
      },
    );
    return NextResponse.json(
      { message: "Inconsistent status — no action" },
      { status: 200 },
    );
  }

  // ── Settlement: shared with the reconcile cron ──
  // Parsing, checkout-row checks, org resolution, amount check, the transaction and the
  // post-commit work all live in settlePaidOrder.
  const result = await settlePaidOrder({
    orderId: order_id,
    grossAmount: notification.gross_amount,
    paymentType: payment_type,
  });

  if (result.kind === "activated") {
    return NextResponse.json({ message: "OK" }, { status: 200 });
  }

  if (result.kind === "already_processed") {
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  // Flagged: not activated, Sentry already alerted inside settlePaidOrder.
  // 200 because a retry can't fix it.
  return NextResponse.json(result.body, { status: 200 });
}
