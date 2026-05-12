// Daily cron job — finds orgs due for renewal today, creates new Midtrans charge
// Vercel calls this every day at 08:00 WIB (01:00 UTC)
// Protected by CRON_SECRET header — rejects all other callers

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSubscriptionTransaction } from "@/lib/midtrans";
import { getOrgsDueForRenewal, markPastDue } from "@/lib/db/queries/billing";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: verify cron secret header ──
  // Vercel automatically sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${env.cronSecret}`;

  if (authHeader !== expected) {
    console.warn("[cron/renewal] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all active orgs whose nextBillingDate is today
  const orgsDue = await getOrgsDueForRenewal();

  if (orgsDue.length === 0) {
    console.log("[cron/renewal] No orgs due today");
    return NextResponse.json({ message: "No orgs due", processed: 0 });
  }

  console.log(`[cron/renewal] Processing ${orgsDue.length} org(s) due today`);

  // Track results for the response log
  const results: Array<{ orgId: string; status: "charged" | "failed" }> = [];

  for (const org of orgsDue) {
    try {
      // Create a new Midtrans transaction for this org's current plan
      // Email is not available here — use a placeholder, owner sees it in Midtrans dashboard
      // Phase 7: pull real email via Clerk API once Resend is wired
      const { redirectUrl } = await createSubscriptionTransaction(
        org.id,
        org.plan,
        "renewal@kundesk.app",
      );

      // Mark as past_due immediately — reactivates to "active" when webhook fires after payment
      // This ensures features are restricted if owner ignores the payment link
      await markPastDue(org.id);

      console.log(
        `[cron/renewal] Charged org ${org.id} — payment link: ${redirectUrl}`,
      );
      results.push({ orgId: org.id, status: "charged" });
    } catch (err) {
      // One failure doesn't stop the loop — process all orgs even if one errors
      console.error(`[cron/renewal] Failed to charge org ${org.id}:`, err);
      results.push({ orgId: org.id, status: "failed" });
    }
  }

  return NextResponse.json({
    message: "Renewal run complete",
    processed: results.length,
    results,
  });
}
