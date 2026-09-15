// Daily cron — permanently deletes orgs whose 30-day deletion grace period
// has expired. Anonymizes payments first (accounting retention), then
// deletes the Clerk org, which fires organization.deleted webhook —
// existing handler soft-cancels a row we're about to remove anyway (harmless).
// Cascade deletes handle chatbots/documents/chunks/conversations/messages.
// Protected by CRON_SECRET header — same pattern as retention/past-due.

import { NextRequest, NextResponse } from "next/server";
import { eq, lte, isNotNull, and } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { orgs, payments } from "@/lib/db/schema";

const GRACE_PERIOD_DAYS = 30;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    console.warn("[cron/org-purge] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS);

  // Any org whose grace period (explicit request OR post-suspension warning,
  // both use the same column) has fully expired
  const dueOrgs = await db
    .select({ id: orgs.id, name: orgs.id })
    .from(orgs)
    .where(
      and(
        isNotNull(orgs.deletionRequestedAt),
        lte(orgs.deletionRequestedAt, cutoff),
      ),
    );

  if (dueOrgs.length === 0) {
    console.log("[cron/org-purge] No orgs due for purge");
    return NextResponse.json({
      message: "No orgs due for purge",
      processed: 0,
    });
  }

  const client = await clerkClient();
  let purged = 0;

  for (const org of dueOrgs) {
    try {
      // Anonymize payments BEFORE deleting the org — orgId set null,
      // amount/plan/paidAt/status kept for aggregate accounting totals.
      // Must happen first: once the org row is gone, there's nothing left
      // to scope this update by.
      await db
        .update(payments)
        .set({ orgId: null })
        .where(eq(payments.orgId, org.id));

      // Deleting the Clerk org fires organization.deleted webhook, which
      // soft-cancels the orgs row. We then hard-delete it ourselves below —
      // the webhook alone would leave all tenant data sitting forever,
      // which is the exact problem this whole feature exists to fix.
      await client.organizations.deleteOrganization(org.id);

      // Cascade deletes handle chatbots/documents/chunks/conversations/messages
      await db.delete(orgs).where(eq(orgs.id, org.id));

      purged++;
    } catch (err) {
      console.error(`[cron/org-purge] Failed to purge org ${org.id}:`, err);
    }
  }

  console.log(`[cron/org-purge] Purged ${purged} orgs`);
  return NextResponse.json({
    message: "Org purge run complete",
    processed: purged,
  });
}
