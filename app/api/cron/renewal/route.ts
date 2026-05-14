// Daily cron job — finds orgs due for renewal today, creates new Midtrans charge
// Vercel calls this every day at 08:00 WIB (01:00 UTC)
// Protected by CRON_SECRET header — rejects all other callers

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { processedWebhooks } from "@/lib/db/schema";
import { createSubscriptionTransaction } from "@/lib/midtrans";
import { sendBillingReminderEmail } from "@/lib/email";
import { getOrgsDueForRenewal, markPastDue } from "@/lib/db/queries/billing";
import { PLAN_PRICE, type PlanName } from "@/types/billing";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: verify cron secret header ──
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${env.cronSecret}`;

  if (authHeader !== expected) {
    console.warn("[cron/renewal] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgsDue = await getOrgsDueForRenewal();

  if (orgsDue.length === 0) {
    console.log("[cron/renewal] No orgs due today");
    return NextResponse.json({ message: "No orgs due", processed: 0 });
  }

  console.log(`[cron/renewal] Processing ${orgsDue.length} org(s) due today`);

  const results: Array<{
    orgId: string;
    status: "charged" | "skipped" | "failed";
  }> = [];

  // Collect email promises — awaited together at the end so serverless runtime
  // doesn't tear down before emails are sent
  const emailTasks: Array<Promise<void>> = [];

  for (const org of orgsDue) {
    // Build a deterministic idempotency key for today's renewal attempt
    // Format: RENEWAL-{orgId}-{YYYY-MM-DD} — one attempt per org per day max
    const today = new Date().toISOString().slice(0, 10);
    const renewalKey = `RENEWAL-${org.id}-${today}`;

    try {
      // ── Idempotency check — did we already attempt this org today? ──
      const [alreadyAttempted] = await db
        .select({ id: processedWebhooks.id })
        .from(processedWebhooks)
        .where(
          and(
            eq(processedWebhooks.source, "midtrans"),
            eq(processedWebhooks.externalId, renewalKey),
          ),
        );

      if (alreadyAttempted) {
        console.log(
          `[cron/renewal] Already attempted org ${org.id} today — skipping`,
        );
        results.push({ orgId: org.id, status: "skipped" });
        continue;
      }

      // ── Record the attempt BEFORE calling Midtrans ──
      // Prevents double-charging even if state transition fails after
      await db.insert(processedWebhooks).values({
        externalId: renewalKey,
        source: "midtrans",
      });

      // Owner email stored on org — no Clerk API call needed
      const ownerEmail = org.ownerEmail;

      if (!ownerEmail) {
        console.warn(
          `[cron/renewal] Org ${org.id} has no ownerEmail — skipping renewal`,
        );
        results.push({ orgId: org.id, status: "failed" });
        continue;
      }

      // ── Create Midtrans transaction ──
      const { redirectUrl } = await createSubscriptionTransaction(
        org.id,
        org.plan,
        ownerEmail,
      );

      // ── Mark as past_due ──
      await markPastDue(org.id);

      // ── Collect email task — awaited together after loop ──
      emailTasks.push(
        sendBillingReminderEmail(
          ownerEmail,
          org.name,
          org.nextBillingDate ?? new Date(),
          PLAN_PRICE[org.plan as PlanName],
          redirectUrl,
          env.logoUrl,
        ).catch((err) =>
          console.error(
            `[cron/renewal] Failed to send billing email for org ${org.id}:`,
            err,
          ),
        ),
      );

      console.log(
        `[cron/renewal] Charged org ${org.id} — payment link: ${redirectUrl}`,
      );
      results.push({ orgId: org.id, status: "charged" });
    } catch (err) {
      // One failure doesn't stop the loop — process all orgs even if one errors
      console.error(`[cron/renewal] Failed to process org ${org.id}:`, err);
      results.push({ orgId: org.id, status: "failed" });
    }
  }

  // Await all email sends before responding — prevents serverless teardown dropping emails
  await Promise.allSettled(emailTasks);

  return NextResponse.json({
    message: "Renewal run complete",
    processed: results.length,
    results,
  });
}
