// Midtrans payment notification handler
// Midtrans POSTs here after every payment event — settlement, pending, expire, etc.
// This handler is the ONLY place that advances the subscription state machine
// Security: signature verification + idempotency check + fraud check

import { NextRequest, NextResponse, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
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
  getPaymentByOrderId,
  OrgPurgingError,
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

// Shape check for the incoming body — runs BEFORE any field is read.
// Values are only bounded here; the real content checks happen later in the handler.
const notificationSchema = z.object({
  order_id: z.string().min(1).max(100),
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().min(1).max(30),
  signature_key: z.string().min(1).max(200),
  transaction_status: z.string().min(1).max(30),
  payment_type: z.string().min(1).max(50),
  fraud_status: z.string().max(30).optional(), // absent on some payment types
});

// Exact order_id format produced by generateOrderId:
// KUNDESK-{8 chars of orgId}-{STARTER|PRO}-{timestamp}[-P{promoId}]
// Groups: 1 = org slice, 2 = plan, 3 = timestamp, 4 = promo id (optional)
const ORDER_ID_PATTERN =
  /^KUNDESK-([A-Za-z0-9_]{8})-(STARTER|PRO)-(\d+)(?:-P(\d+))?$/;

// True for a Postgres unique-violation (23505) — checks err.code and err.cause.code,
// because Drizzle may wrap the driver error inside a cause
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const direct = (err as { code?: unknown }).code;
  const cause = (err as { cause?: { code?: unknown } }).cause?.code;
  return direct === "23505" || cause === "23505";
}

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
  // returns 503. Midtrans retries a 503 up to 4 times, a plain 500 only once.
  // We must never answer 200 for a payment we failed to record.
  try {
    return await processNotification(notification);
  } catch (err) {
    console.error(
      "[midtrans webhook] Unexpected error — asking Midtrans to retry",
      {
        order_id: notification.order_id,
        err,
      },
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

    // Explicit Sentry capture — this is exactly the kind of event that should
    // page someone, not just sit in Vercel logs. orgId not yet resolved at
    // this point in the handler, so order_id is the correlation key.
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
    // Support team will see the payment in the payment_history with status=pending
    // and can investigate and either manually activate or refund
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

  // Strict order_id parse — must match the exact format generateOrderId produces
  const orderMatch = ORDER_ID_PATTERN.exec(order_id);

  if (!orderMatch) {
    // A retry can never fix a malformed id, so answer 200 — but the money is real, so alert Sentry
    console.error(
      "[midtrans webhook] Unparseable order_id on a settled payment",
      {
        order_id,
      },
    );
    Sentry.captureMessage(
      "midtrans webhook: settled payment with unparseable order_id",
      {
        level: "error",
        extra: { orderId: order_id },
      },
    );
    return NextResponse.json(
      { message: "Unprocessable order_id — flagged for review" },
      { status: 200 },
    );
  }

  // Pieces of the order_id (regex groups 1, 2 and 4)
  const orgIdSlice = orderMatch[1]!;
  // The regex only allows STARTER or PRO, so this cast is safe
  const plan = orderMatch[2]!.toLowerCase() as PlanName;
  const promoId = orderMatch[4] ? parseInt(orderMatch[4], 10) : null;

  // The checkout row written at payment creation is the source of truth for this order
  const paymentRecord = await getPaymentByOrderId(order_id);
  const reportedAmount = parseInt(notification.gross_amount, 10);

  // Real mode: a settlement for an order we never created is never activated
  if (!paymentRecord && env.paymentMode !== "mock") {
    console.error("[midtrans webhook] Settled payment has no checkout record", {
      order_id,
    });
    Sentry.captureMessage(
      "midtrans webhook: settled payment has no checkout record",
      {
        level: "error",
        extra: { orderId: order_id, reportedAmount },
      },
    );
    return NextResponse.json(
      { message: "No checkout record — flagged for review" },
      { status: 200 },
    );
  }

  // The row and the order_id must agree on org and plan
  if (
    paymentRecord &&
    ((paymentRecord.orgId !== null &&
      !paymentRecord.orgId.startsWith(orgIdSlice)) ||
      paymentRecord.plan !== plan)
  ) {
    console.error(
      "[midtrans webhook] order_id does not match checkout record",
      {
        order_id,
      },
    );
    Sentry.captureMessage(
      "midtrans webhook: order_id does not match checkout record",
      {
        level: "error",
        extra: {
          orderId: order_id,
          recordPlan: paymentRecord.plan,
          orderIdPlan: plan,
        },
      },
    );
    // Mark processed so Midtrans stops retrying — support handles it from Sentry
    await db
      .insert(processedWebhooks)
      .values({ externalId: order_id, source: "midtrans" })
      .onConflictDoNothing();
    return NextResponse.json(
      { message: "Order mismatch — flagged for review" },
      { status: 200 },
    );
  }

  // Settlement for an order that is no longer pending (cancelled/expired/failed).
  // Still activated — real money arrived (rule 160) — but a human should know.
  if (paymentRecord && paymentRecord.status !== "pending") {
    Sentry.captureMessage(
      "midtrans webhook: settlement for a non-pending order",
      {
        level: "warning",
        extra: { orderId: order_id, rowStatus: paymentRecord.status },
      },
    );
  }

  // Resolve the org. With a checkout row: by the full orgId stored on it (no prefix guessing).
  // Without a row (mock mode only — real mode returned above): the old 8-char prefix lookup.
  const orgFilter: SQL | undefined = paymentRecord
    ? paymentRecord.orgId
      ? eq(orgs.id, paymentRecord.orgId)
      : undefined // org was purged — nothing to activate
    : sql`LEFT(${orgs.id}, 8) = ${orgIdSlice}`;

  const matchingOrgs = orgFilter
    ? await db
        .select({ id: orgs.id, name: orgs.name, ownerEmail: orgs.ownerEmail })
        .from(orgs)
        .where(orgFilter)
    : [];

  if (matchingOrgs.length !== 1) {
    console.error("[midtrans webhook] Org resolution failed", {
      order_id,
      orgIdSlice,
      matches: matchingOrgs.length,
    });
    // The payment is real but we can't activate anyone — this must never be silent
    Sentry.captureMessage("midtrans webhook: org resolution failed", {
      level: "error",
      extra: {
        orderId: order_id,
        orgIdSlice,
        matches: matchingOrgs.length,
        hasCheckoutRecord: paymentRecord !== null,
      },
    });
    return NextResponse.json(
      { error: "Org resolution failed" },
      { status: 200 },
    );
  }

  const org = matchingOrgs[0]!;

  // Amount validation — the signature proves Midtrans sent this, not that the amount is right
  if (paymentRecord && paymentRecord.amount !== reportedAmount) {
    console.error("[midtrans webhook] Amount mismatch — refusing to activate", {
      order_id,
      expected: paymentRecord.amount,
      reported: reportedAmount,
    });

    Sentry.captureMessage("midtrans webhook: amount mismatch", {
      level: "error",
      extra: {
        orgId: org.id,
        orderId: order_id,
        expectedAmount: paymentRecord.amount,
        reportedAmount,
      },
    });

    // Mark processed so Midtrans stops retrying — support handles it from Sentry
    await db
      .insert(processedWebhooks)
      .values({ externalId: order_id, source: "midtrans" })
      .onConflictDoNothing();

    return NextResponse.json(
      { message: "Amount mismatch — flagged for review" },
      { status: 200 },
    );
  }

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

  try {
    await db.transaction(async (tx) => {
      const result = await activateSubscription(org.id, plan, payment_type, tx);
      periodEnd = result.periodEnd;

      await markPaymentSuccess(
        org.id,
        order_id,
        plan,
        parseInt(notification.gross_amount, 10),
        payment_type,
        tx, // same transaction as activation — rolls back together
      );

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
  } catch (err) {
    // A concurrent retry may have finished this order a moment earlier, so our own
    // processedWebhooks insert hit the unique constraint. Confirm that before answering 200 —
    // a unique violation from anywhere else must still become a 503.
    if (isUniqueViolation(err)) {
      const [finished] = await db
        .select({ id: processedWebhooks.id })
        .from(processedWebhooks)
        .where(
          and(
            eq(processedWebhooks.source, "midtrans"),
            eq(processedWebhooks.externalId, order_id),
          ),
        );

      if (finished) {
        console.log("[midtrans webhook] Finished by a concurrent retry", {
          order_id,
        });
        return NextResponse.json(
          { message: "Already processed" },
          { status: 200 },
        );
      }
    }

    // ⚠️ Only the purge race gets the "mark processed, stop retrying" treatment below.
    // Any other error (timeout, dropped connection) is rethrown → POST returns 503 →
    // Midtrans retries, and the customer still gets activated.
    if (!(err instanceof OrgPurgingError)) {
      throw err;
    }

    // Org was purged (or claimed for purging) in the moment this webhook was
    // processing — extremely rare race, but must not surface as a 500 and
    // trigger endless Midtrans retries. Log for manual review; the payment
    // itself is real and the customer may need a manual refund since their
    // org no longer exists.
    console.error(
      "[midtrans webhook] Activation failed — possible org purge race",
      { order_id, orgId: org.id, err },
    );

    Sentry.captureMessage(
      "midtrans webhook: activation failed post-purge-guard",
      {
        level: "error",
        extra: { orderId: order_id, orgId: org.id },
      },
    );

    // processedWebhooks was inside the rolled-back transaction, so it's NOT
    // marked processed — Midtrans will retry. That's fine for ordinary
    // transient failures, but for this specific race the org is gone, so
    // retrying forever accomplishes nothing. Mark it processed here,
    // separately, so retries stop — support handles it manually from Sentry.
    // onConflictDoNothing ignores ONLY a duplicate (a concurrent retry already marked it).
    // Any other DB error (timeout, outage) is not swallowed → POST returns 503 → Midtrans retries.
    await db
      .insert(processedWebhooks)
      .values({ externalId: order_id, source: "midtrans" })
      .onConflictDoNothing();

    return NextResponse.json(
      { message: "Activation failed — flagged for review" },
      { status: 200 },
    );
  }

  console.log("[midtrans webhook] Subscription activated", {
    orgId: org.id,
    plan,
    order_id,
  });

  // Everything below runs AFTER the commit. The customer is already activated, so nothing
  // here may turn the response into a 503 — each step handles its own failure.
  const planLabel = plan === "pro" ? "Pro" : "Starter";

  // Dashboard bell — awaited so the owner sees it immediately; a failure is reported, not thrown
  try {
    await createNotification(
      org.id,
      "plan_upgraded",
      `Plan berhasil diupgrade ke ${planLabel}`,
      `Pembayaran dikonfirmasi · ${order_id}`,
    );
  } catch (err) {
    console.error("[midtrans webhook] Failed to create notification:", err);
    Sentry.captureException(err, {
      extra: { orgId: org.id, orderId: order_id },
    });
  }

  // Email + analytics run via after(): the response goes out first, and Vercel keeps
  // the function alive until they finish (fire-and-forget can be cut off on Vercel)
  after(async () => {
    if (org.ownerEmail) {
      try {
        await sendPlanUpgradedEmail(
          org.ownerEmail,
          org.name,
          plan,
          reportedAmount,
          payment_type,
          order_id,
          new Date(),
          periodEnd,
          env.logoUrl,
        );
      } catch (err) {
        console.error("[midtrans webhook] Failed to send upgrade email:", err);
        Sentry.captureException(err, {
          extra: { orgId: org.id, orderId: order_id },
        });
      }
    } else {
      // No address on file — nothing to send to
      console.warn(
        "[midtrans webhook] No owner email — upgrade email skipped",
        {
          orgId: org.id,
        },
      );
    }

    try {
      await trackEventImmediate(org.id, "plan_upgraded", {
        plan,
        payment_type,
        has_promo: promoId !== null,
      });
    } catch (err) {
      // Analytics must never affect a payment that is already recorded
      console.error("[midtrans webhook] Failed to track plan_upgraded:", err);
    }
  });

  return NextResponse.json({ message: "OK" }, { status: 200 });
}
