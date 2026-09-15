// Daily cron — permanently deletes orgs whose 30-day deletion grace period
// has expired. Claims each org atomically before acting (purgingAt) so a
// cancelOrgDeletion() call racing against this cron can never un-cancel an
// org that's already mid-purge. Deletes Clerk first — an already-missing
// Clerk org is treated as success (idempotent on retry). DB deletion runs
// in a transaction; ON DELETE SET NULL anonymizes payments automatically.
// Protected by CRON_SECRET header — same pattern as retention/past-due.

import { NextRequest, NextResponse } from "next/server";
import { eq, lte, isNotNull, isNull, and } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";

const GRACE_PERIOD_DAYS = 30;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    console.warn("[cron/org-purge] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS);

  // Snapshot only — not a claim. Each org is claimed individually below
  // right before acting on it, so this list going stale between the query
  // and the loop is safe.
  const candidateOrgs = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(
      and(
        isNotNull(orgs.deletionRequestedAt),
        lte(orgs.deletionRequestedAt, cutoff),
        isNull(orgs.purgingAt),
      ),
    );

  if (candidateOrgs.length === 0) {
    console.log("[cron/org-purge] No orgs due for purge");
    return NextResponse.json({
      message: "No orgs due for purge",
      processed: 0,
    });
  }

  const client = await clerkClient();
  let purged = 0;

  for (const candidate of candidateOrgs) {
    try {
      // Atomic claim — only succeeds if the org is still actually eligible
      // right now. If an admin cancelled between the query above and this
      // update, deletionRequestedAt is null and the claim returns nothing.
      const claimed = await db
        .update(orgs)
        .set({ purgingAt: new Date() })
        .where(
          and(
            eq(orgs.id, candidate.id),
            isNotNull(orgs.deletionRequestedAt),
            lte(orgs.deletionRequestedAt, cutoff),
            isNull(orgs.purgingAt),
          ),
        )
        .returning({ id: orgs.id });

      if (claimed.length === 0) {
        console.log(
          `[cron/org-purge] Org ${candidate.id} no longer eligible — skipped`,
        );
        continue;
      }

      // Delete Clerk first. If this throws, the org stays claimed
      // (purgingAt set) but not deleted — surfaces in logs for manual
      // follow-up rather than silently retrying a half-finished state.
      try {
        await client.organizations.deleteOrganization(candidate.id);
      } catch (err) {
        // Already deleted from Clerk (e.g. a prior run got this far but
        // failed after) — treat as success and continue to DB cleanup.
        const isNotFound =
          err instanceof Error && "status" in err && err.status === 404;
        if (!isNotFound) throw err;
      }

      // DB deletion in a transaction — payments.orgId is set null
      // automatically via ON DELETE SET NULL, no manual update needed.
      await db.transaction(async (tx) => {
        await tx.delete(orgs).where(eq(orgs.id, candidate.id));
      });

      purged++;
    } catch (err) {
      console.error(
        `[cron/org-purge] Failed to purge org ${candidate.id}:`,
        err,
      );
    }
  }

  console.log(`[cron/org-purge] Purged ${purged} orgs`);
  return NextResponse.json({
    message: "Org purge run complete",
    processed: purged,
  });
}
