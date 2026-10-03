// Daily cron — recovers payments whose Midtrans webhook never reached us,
// then closes stale pending checkouts.
// ORDER MATTERS: reconcile FIRST. The expire sweep marks old pending rows "expired",
// which would hide a paid-but-never-notified order from the reconcile step.
// Vercel calls this daily at 19:00 UTC (02:00 WIB). Protected by CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { processedWebhooks } from "@/lib/db/schema";
import { getMidtransTransactionStatus } from "@/lib/midtrans";
import { settlePaidOrder } from "@/lib/billing/settle-payment";
import {
  expireStalePayments,
  getReconcileCandidates,
} from "@/lib/db/queries/billing";

// Orders checked per run — Vercel free functions stop at 10 seconds
const BATCH_SIZE = 10;

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: verify cron secret header ──
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    console.warn("[cron/payment-reconcile] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let checked = 0;
  let recovered = 0;
  let flagged = 0;
  let errors = 0;
  let reconcileFailed = false;

  // ── Step 1: reconcile ──
  // Own try/catch: a failure here must never stop the expire sweep below.
  // Mock mode has no real Midtrans orders, so there is nothing to ask.
  if (env.paymentMode !== "mock") {
    try {
      const candidates = await getReconcileCandidates(BATCH_SIZE);
      checked = candidates.length;

      // Status calls run in parallel (3s timeout each); settlements run one by one below
      const statuses = await Promise.allSettled(
        candidates.map((candidate) =>
          getMidtransTransactionStatus(candidate.orderId),
        ),
      );

      for (const [index, candidate] of candidates.entries()) {
        const outcome = statuses[index]!;

        // Status lookup failed — skip, the next run tries again
        if (outcome.status === "rejected") {
          errors++;
          Sentry.captureException(outcome.reason, {
            extra: { orderId: candidate.orderId, step: "get-status" },
          });
          continue;
        }

        const midtrans = outcome.value;

        // Midtrans has no transaction: never paid — nothing to recover
        if (!midtrans.found) continue;

        // Only a completed payment is recoverable (same rule as the webhook)
        const isSettled =
          midtrans.transactionStatus === "settlement" ||
          midtrans.transactionStatus === "capture";
        if (!isSettled) continue;

        // Fraud-flagged: never activate. Mark processed so the cron stops revisiting it.
        if (
          midtrans.fraudStatus === "challenge" ||
          midtrans.fraudStatus === "deny"
        ) {
          flagged++;
          Sentry.captureMessage(
            "payment-reconcile: fraud flag on a lost order",
            {
              level: "error",
              extra: {
                orderId: candidate.orderId,
                fraudStatus: midtrans.fraudStatus,
              },
            },
          );
          await db
            .insert(processedWebhooks)
            .values({ externalId: candidate.orderId, source: "midtrans" })
            .onConflictDoNothing();
          continue;
        }

        // A normal settlement always carries status_code "200"
        if (midtrans.statusCode !== "200") continue;

        try {
          const result = await settlePaidOrder({
            orderId: candidate.orderId,
            grossAmount: midtrans.grossAmount,
            paymentType: midtrans.paymentType,
          });

          if (result.kind === "activated") {
            recovered++;
            // A recovery means a webhook was lost — a human should know about it
            Sentry.captureMessage(
              "payment-reconcile: recovered a payment whose webhook was lost",
              {
                level: "warning",
                extra: {
                  orderId: candidate.orderId,
                  previousRowStatus: candidate.status,
                },
              },
            );
          } else if (result.kind === "flagged") {
            // Not activated — settlePaidOrder already alerted Sentry
            flagged++;
          }
          // "already_processed": a concurrent run finished it — nothing to do
        } catch (err) {
          errors++;
          Sentry.captureException(err, {
            extra: { orderId: candidate.orderId, step: "settle" },
          });
        }
      }

      console.log(
        `[cron/payment-reconcile] checked ${checked}, recovered ${recovered}, flagged ${flagged}, errors ${errors}`,
      );
    } catch (err) {
      // The whole step failed (e.g. the candidate query) — report it, still run the sweep
      reconcileFailed = true;
      console.error("[cron/payment-reconcile] Reconcile step failed:", err);
      Sentry.captureException(err, { extra: { step: "reconcile" } });
    }
  }

  // ── Step 2: housekeeping — close payment rows whose 24h Snap link has passed ──
  // Moved here from the retention cron so it always runs AFTER reconcile.
  let expiredPayments = 0;
  try {
    expiredPayments = await expireStalePayments();
    console.log(
      `[cron/payment-reconcile] Expired ${expiredPayments} stale pending payment(s)`,
    );
  } catch (err) {
    reconcileFailed = true;
    console.error(
      "[cron/payment-reconcile] Failed to expire stale payments:",
      err,
    );
    Sentry.captureException(err, { extra: { step: "expire-sweep" } });
  }

  // 500 when a whole step failed, so "no alerts" can never silently mean "check is broken"
  return NextResponse.json(
    { checked, recovered, flagged, errors, expiredPayments },
    { status: reconcileFailed ? 500 : 200 },
  );
}
