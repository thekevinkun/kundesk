// Settles ONE paid Midtrans order — shared by the webhook and the reconcile cron.
// One code path on purpose: a payment recovered by the cron must be treated exactly
// like one that arrived by webhook (same checks, same transaction, same alerts).
// The CALLER decides that an order is paid (webhook: signed notification, cron: Get Status).

import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { trackEventImmediate } from "@/lib/posthog";
import { sendPlanUpgradedEmail } from "@/lib/email";
import { createNotification } from "@/lib/db/queries/dashboard";
import { orgs, processedWebhooks, promoCodes } from "@/lib/db/schema";
import {
  activateSubscription,
  markPaymentSuccess,
  getPaymentByOrderId,
  OrgPurgingError,
} from "@/lib/db/queries/billing";
import type { PlanName } from "@/types/billing";
import type { SettleInput, SettleResult } from "@/types/settlement";

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

// Marks an order processed so Midtrans (or the cron) stops revisiting it
async function markProcessed(orderId: string): Promise<void> {
  await db
    .insert(processedWebhooks)
    .values({ externalId: orderId, source: "midtrans" })
    .onConflictDoNothing();
}

export async function settlePaidOrder(
  input: SettleInput,
): Promise<SettleResult> {
  const { orderId, grossAmount, paymentType } = input;

  // Strict order_id parse — must match the exact format generateOrderId produces
  const orderMatch = ORDER_ID_PATTERN.exec(orderId);

  if (!orderMatch) {
    // A retry can never fix a malformed id — but the money is real, so alert Sentry
    console.error(
      "[settle-payment] Unparseable order_id on a settled payment",
      {
        orderId,
      },
    );
    Sentry.captureMessage(
      "midtrans webhook: settled payment with unparseable order_id",
      { level: "error", extra: { orderId } },
    );
    return {
      kind: "flagged",
      body: { message: "Unprocessable order_id — flagged for review" },
    };
  }

  // Pieces of the order_id (regex groups 1, 2 and 4)
  const orgIdSlice = orderMatch[1]!;
  // The regex only allows STARTER or PRO, so this cast is safe
  const plan = orderMatch[2]!.toLowerCase() as PlanName;
  const promoId = orderMatch[4] ? parseInt(orderMatch[4], 10) : null;

  // The checkout row written at payment creation is the source of truth for this order
  const paymentRecord = await getPaymentByOrderId(orderId);
  const reportedAmount = parseInt(grossAmount, 10);

  // Real mode: a settlement for an order we never created is never activated
  if (!paymentRecord && env.paymentMode !== "mock") {
    console.error("[settle-payment] Settled payment has no checkout record", {
      orderId,
    });
    Sentry.captureMessage(
      "midtrans webhook: settled payment has no checkout record",
      { level: "error", extra: { orderId, reportedAmount } },
    );
    return {
      kind: "flagged",
      body: { message: "No checkout record — flagged for review" },
    };
  }

  // The row and the order_id must agree on org and plan
  if (
    paymentRecord &&
    ((paymentRecord.orgId !== null &&
      !paymentRecord.orgId.startsWith(orgIdSlice)) ||
      paymentRecord.plan !== plan)
  ) {
    console.error("[settle-payment] order_id does not match checkout record", {
      orderId,
    });
    Sentry.captureMessage(
      "midtrans webhook: order_id does not match checkout record",
      {
        level: "error",
        extra: {
          orderId,
          recordPlan: paymentRecord.plan,
          orderIdPlan: plan,
        },
      },
    );
    // Mark processed so nobody retries — support handles it from Sentry
    await markProcessed(orderId);
    return {
      kind: "flagged",
      body: { message: "Order mismatch — flagged for review" },
    };
  }

  // Settlement for an order that is no longer pending (cancelled/expired/failed).
  // Still activated — real money arrived (rule 160) — but a human should know.
  if (paymentRecord && paymentRecord.status !== "pending") {
    Sentry.captureMessage(
      "midtrans webhook: settlement for a non-pending order",
      {
        level: "warning",
        extra: { orderId, rowStatus: paymentRecord.status },
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
    console.error("[settle-payment] Org resolution failed", {
      orderId,
      orgIdSlice,
      matches: matchingOrgs.length,
    });
    // The payment is real but we can't activate anyone — this must never be silent
    Sentry.captureMessage("midtrans webhook: org resolution failed", {
      level: "error",
      extra: {
        orderId,
        orgIdSlice,
        matches: matchingOrgs.length,
        hasCheckoutRecord: paymentRecord !== null,
      },
    });

    // The org was purged (the checkout row's orgId is null): no retry and no later cron run
    // can ever fix this. Mark it processed so it isn't re-checked and re-alerted every day —
    // the Sentry error above is the alert.
    if (paymentRecord && paymentRecord.orgId === null) {
      await markProcessed(orderId);
    }

    return { kind: "flagged", body: { error: "Org resolution failed" } };
  }

  const org = matchingOrgs[0]!;

  // Amount validation — the signature/status proves Midtrans says it's paid, not that the amount is right
  if (paymentRecord && paymentRecord.amount !== reportedAmount) {
    console.error("[settle-payment] Amount mismatch — refusing to activate", {
      orderId,
      expected: paymentRecord.amount,
      reported: reportedAmount,
    });
    Sentry.captureMessage("midtrans webhook: amount mismatch", {
      level: "error",
      extra: {
        orgId: org.id,
        orderId,
        expectedAmount: paymentRecord.amount,
        reportedAmount,
      },
    });
    // Mark processed so nobody retries — support handles it from Sentry
    await markProcessed(orderId);
    return {
      kind: "flagged",
      body: { message: "Amount mismatch — flagged for review" },
    };
  }

  // ⚠️ CRITICAL ORDERING: the processedWebhooks insert is INSIDE the transaction.
  // If it were outside, a rollback would leave the order marked processed with nothing
  // activated, and the order would never be retried or recovered. Inside, a rollback
  // un-marks it, so the next webhook retry (or the next cron run) tries again from scratch.
  // activateSubscription is idempotent (SET, not INSERT); markPaymentSuccess updates by orderId.
  let periodEnd!: Date;

  try {
    await db.transaction(async (tx) => {
      const result = await activateSubscription(org.id, plan, paymentType, tx);
      periodEnd = result.periodEnd;

      await markPaymentSuccess(
        org.id,
        orderId,
        plan,
        reportedAmount,
        paymentType,
        tx, // same transaction as activation — rolls back together
      );

      if (promoId !== null) {
        await tx
          .update(promoCodes)
          .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
          .where(eq(promoCodes.id, promoId));
      }

      await tx.insert(processedWebhooks).values({
        externalId: orderId,
        source: "midtrans",
      });
    });
  } catch (err) {
    // A concurrent run may have finished this order a moment earlier, so our own
    // processedWebhooks insert hit the unique constraint. Confirm that before reporting
    // "already processed" — a unique violation from anywhere else must stay an error.
    if (isUniqueViolation(err)) {
      const [finished] = await db
        .select({ id: processedWebhooks.id })
        .from(processedWebhooks)
        .where(
          and(
            eq(processedWebhooks.source, "midtrans"),
            eq(processedWebhooks.externalId, orderId),
          ),
        );

      if (finished) {
        console.log("[settle-payment] Finished by a concurrent run", {
          orderId,
        });
        return { kind: "already_processed" };
      }
    }

    // Only the purge race is handled here; any other error (timeout, dropped
    // connection) is rethrown so the caller can retry later
    if (!(err instanceof OrgPurgingError)) {
      throw err;
    }

    // Org was purged (or claimed for purging) while this was processing. Retrying is
    // pointless — the payment is real and may need a manual refund.
    console.error(
      "[settle-payment] Activation failed — possible org purge race",
      { orderId, orgId: org.id, err },
    );
    Sentry.captureMessage(
      "midtrans webhook: activation failed post-purge-guard",
      { level: "error", extra: { orderId, orgId: org.id } },
    );

    // processedWebhooks was inside the rolled-back transaction — mark it separately.
    // Only a duplicate is ignored; any other DB error propagates so the caller can retry.
    await markProcessed(orderId);

    return {
      kind: "flagged",
      body: { message: "Activation failed — flagged for review" },
    };
  }

  console.log("[settle-payment] Subscription activated", {
    orgId: org.id,
    plan,
    orderId,
  });

  // Everything below runs AFTER the commit. The customer is already activated, so nothing
  // here may throw — each step handles its own failure.
  const planLabel = plan === "pro" ? "Pro" : "Starter";

  // Dashboard bell — awaited so the owner sees it immediately; a failure is reported, not thrown
  try {
    await createNotification(
      org.id,
      "plan_upgraded",
      `Plan berhasil diupgrade ke ${planLabel}`,
      `Pembayaran dikonfirmasi · ${orderId}`,
    );
  } catch (err) {
    console.error("[settle-payment] Failed to create notification:", err);
    Sentry.captureException(err, { extra: { orgId: org.id, orderId } });
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
          paymentType,
          orderId,
          new Date(),
          periodEnd,
          env.logoUrl,
        );
      } catch (err) {
        console.error("[settle-payment] Failed to send upgrade email:", err);
        Sentry.captureException(err, { extra: { orgId: org.id, orderId } });
      }
    } else {
      // No address on file — nothing to send to
      console.warn("[settle-payment] No owner email — upgrade email skipped", {
        orgId: org.id,
      });
    }

    try {
      await trackEventImmediate(org.id, "plan_upgraded", {
        plan,
        payment_type: paymentType,
        has_promo: promoId !== null,
      });
    } catch (err) {
      // Analytics must never affect a payment that is already recorded
      console.error("[settle-payment] Failed to track plan_upgraded:", err);
    }
  });

  return { kind: "activated" };
}
