// Daily cron — warns orgs that have been suspended for 90+ days that
// deletion is about to be scheduled. Runs before org-purge so the warning
// always precedes the actual deletionRequestedAt stamp by one day's buffer.
// Protected by CRON_SECRET header — same pattern as retention/past-due.

import { NextRequest, NextResponse } from "next/server";
import { eq, and, lte, isNull } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { sendSuspendedWarningEmail } from "@/lib/email";

// Orgs suspended this long without ever requesting deletion get one warning
// email, then org-purge starts their 30-day clock the day after.
const SUSPENDED_WARNING_DAYS = 90;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    console.warn("[cron/suspended-warning] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SUSPENDED_WARNING_DAYS);

  // Orgs suspended 90+ days ago, never warned (deletionRequestedAt still null)
  const staleOrgs = await db
    .select({
      id: orgs.id,
      name: orgs.name,
      ownerEmail: orgs.ownerEmail,
      suspendedAt: orgs.suspendedAt,
    })
    .from(orgs)
    .where(
      and(
        eq(orgs.subscriptionStatus, "suspended"),
        lte(orgs.suspendedAt, cutoff),
        isNull(orgs.deletionRequestedAt),
      ),
    );

  if (staleOrgs.length === 0) {
    console.log("[cron/suspended-warning] No orgs to warn");
    return NextResponse.json({ message: "No orgs to warn", processed: 0 });
  }

  let warned = 0;

  for (const org of staleOrgs) {
    try {
      // Stamp deletionRequestedAt now — starts the same 30-day grace period
      // as the explicit-request path. org-purge will pick this up from here.
      await db
        .update(orgs)
        .set({ deletionRequestedAt: new Date() })
        .where(eq(orgs.id, org.id));

      if (org.ownerEmail) {
        const purgeDate = new Date();
        purgeDate.setDate(purgeDate.getDate() + 30);

        await sendSuspendedWarningEmail(
          org.ownerEmail,
          org.name,
          purgeDate,
          env.logoUrl,
        );
      }

      warned++;
    } catch (err) {
      console.error(
        `[cron/suspended-warning] Failed to process org ${org.id}:`,
        err,
      );
    }
  }

  console.log(`[cron/suspended-warning] Warned ${warned} orgs`);
  return NextResponse.json({
    message: "Suspended warning run complete",
    processed: warned,
  });
}
