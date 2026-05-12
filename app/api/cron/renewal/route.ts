// Daily cron job — finds orgs due for renewal today, creates new Midtrans charge
// Vercel calls this every day at 08:00 WIB (01:00 UTC)
// Protected by CRON_SECRET header — rejects all other callers

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { processedWebhooks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getOrgsDueForRenewal, markPastDue } from "@/lib/db/queries/billing";
import { createSubscriptionTransaction } from "@/lib/midtrans";

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

  for (const org of orgsDue) {
    // Build a deterministic idempotency key for today's renewal attempt
    // Format: RENEWAL-{orgId}-{YYYY-MM-DD} — one attempt per org per day max
    const today = new Date().toISOString().slice(0, 10);
    const renewalKey = `RENEWAL-${org.id}-${today}`;

    try {
      // ── Idempotency check — did we already attempt this org today? ──
      // Prevents double-charging if cron fires twice or markPastDue failed last run
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
      // If Midtrans succeeds but markPastDue fails, next run sees this record and skips
      // This prevents double-charging even if the state transition fails
      await db.insert(processedWebhooks).values({
        externalId: renewalKey,
        source: "midtrans",
      });

      // ── Create Midtrans transaction ──
      // Phase 7: pull real owner email via Clerk API once Resend is wired
      const { redirectUrl } = await createSubscriptionTransaction(
        org.id,
        org.plan,
        "renewal@kundesk.app",
      );

      // ── Mark as past_due — reactivates to "active" when webhook fires after payment ──
      await markPastDue(org.id);

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

  return NextResponse.json({
    message: "Renewal run complete",
    processed: results.length,
    results,
  });
}
