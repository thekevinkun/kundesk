// Daily cron — finds orgs that are past_due and handles escalation
// Day 3: send past due email warning
// Day 7: suspend the subscription — Pro features blocked
// Vercel calls this every day at 09:00 WIB (02:00 UTC)
// Protected by CRON_SECRET header

import { NextRequest, NextResponse } from "next/server";
import { eq, lte, and } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { sendPastDueEmail } from "@/lib/email";
import { processedWebhooks } from "@/lib/db/schema";
import { suspendSubscription } from "@/lib/db/queries/billing";
import { PLAN_PRICE, type PlanName } from "@/types/billing";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    console.warn("[cron/past-due] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Fetch all orgs currently past_due
  // We check takenOverAt as a proxy — actually we need nextBillingDate
  // past_due orgs have nextBillingDate in the past — calculate days overdue from that
  const pastDueOrgs = await db
    .select({
      id: orgs.id,
      name: orgs.name,
      plan: orgs.plan,
      ownerEmail: orgs.ownerEmail,
      nextBillingDate: orgs.nextBillingDate,
    })
    .from(orgs)
    .where(
      and(
        eq(orgs.subscriptionStatus, "past_due"),
        // nextBillingDate is in the past — only orgs that have missed payment
        lte(orgs.nextBillingDate, now),
      ),
    );

  if (pastDueOrgs.length === 0) {
    console.log("[cron/past-due] No past_due orgs found");
    return NextResponse.json({ message: "No past_due orgs", processed: 0 });
  }

  const results: Array<{
    orgId: string;
    status: "warned" | "suspended" | "skipped";
  }> = [];

  for (const org of pastDueOrgs) {
    if (!org.nextBillingDate) {
      results.push({ orgId: org.id, status: "skipped" });
      continue;
    }

    // Calculate how many days overdue this org is
    const msOverdue = now.getTime() - org.nextBillingDate.getTime();
    const daysOverdue = Math.floor(msOverdue / (1000 * 60 * 60 * 24));

    try {
      if (daysOverdue >= 7) {
        // ── Day 7+: suspend ──
        await suspendSubscription(org.id);
        console.log(
          `[cron/past-due] Suspended org ${org.id} — ${daysOverdue} days overdue`,
        );
        results.push({ orgId: org.id, status: "suspended" });
      } else if (daysOverdue >= 3) {
        // ── Day 3 only — use idempotency key to prevent repeat emails ──
        // Key format: PASTDUE-{orgId}-{billingDate} — unique per billing cycle
        const billingDateStr = org.nextBillingDate.toISOString().slice(0, 10);
        const pastDueKey = `PASTDUE-${org.id}-${billingDateStr}`;

        const [alreadyWarned] = await db
          .select({ id: processedWebhooks.id })
          .from(processedWebhooks)
          .where(
            and(
              eq(processedWebhooks.source, "midtrans"),
              eq(processedWebhooks.externalId, pastDueKey),
            ),
          );

        if (!alreadyWarned) {
          // Record before sending — prevents duplicate emails on cron retry
          await db.insert(processedWebhooks).values({
            externalId: pastDueKey,
            source: "midtrans",
          });

          if (org.ownerEmail) {
            sendPastDueEmail(
              org.ownerEmail,
              org.name,
              PLAN_PRICE[org.plan as PlanName],
              env.logoUrl,
            ).catch((err) =>
              console.error(
                `[cron/past-due] Failed to send email for org ${org.id}:`,
                err,
              ),
            );
          }
        }

        console.log(
          `[cron/past-due] Warned org ${org.id} — ${daysOverdue} days overdue`,
        );
        results.push({ orgId: org.id, status: "warned" });
      } else {
        // Day 1–2: grace period, no action yet
        results.push({ orgId: org.id, status: "skipped" });
      }
    } catch (err) {
      console.error(`[cron/past-due] Failed to process org ${org.id}:`, err);
    }
  }

  return NextResponse.json({
    message: "Past due run complete",
    processed: results.length,
    results,
  });
}
