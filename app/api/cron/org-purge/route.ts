// Daily cron — permanently deletes orgs whose 30-day deletion grace period
// has expired. Claims each org atomically before acting (purgingAt) so a
// cancelOrgDeletion() call racing against this cron can never un-cancel an
// org that's already mid-purge. Deletes Clerk first — an already-missing
// Clerk org is treated as success. DB deletion runs in a transaction;
// ON DELETE SET NULL anonymizes payments automatically.
// A claim older than STALE_CLAIM_HOURS is treated as abandoned (the run that made it
// failed or crashed) and is taken over by the next run — every step is safe to repeat.
// Every failure is reported to Sentry with the step that failed.
// Protected by CRON_SECRET header — same pattern as retention/past-due.

import { NextRequest, NextResponse } from "next/server";
import { eq, lte, isNotNull, isNull, and, or } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";

const GRACE_PERIOD_DAYS = 30;
// A claim older than this is abandoned — far longer than a run takes, shorter than a day
const STALE_CLAIM_HOURS = 6;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    console.warn("[cron/org-purge] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS);

  // Claims made before this moment are considered abandoned
  const staleClaimCutoff = new Date(
    Date.now() - STALE_CLAIM_HOURS * 60 * 60 * 1000,
  );

  // ONE definition of "eligible", used by both the snapshot and the claim below, so the two
  // can never drift apart: grace period over, and either never claimed or claimed long ago
  const eligible = and(
    isNotNull(orgs.deletionRequestedAt),
    lte(orgs.deletionRequestedAt, cutoff),
    or(isNull(orgs.purgingAt), lte(orgs.purgingAt, staleClaimCutoff)),
  );

  // Snapshot only — not a claim. Each org is claimed individually below
  // right before acting on it, so this list going stale between the query
  // and the loop is safe. purgingAt tells us whether a candidate is a takeover.
  let candidateOrgs: Array<{ id: string; purgingAt: Date | null }>;
  try {
    candidateOrgs = await db
      .select({ id: orgs.id, purgingAt: orgs.purgingAt })
      .from(orgs)
      .where(eligible);
  } catch (err) {
    // A broken check must never look like "nothing to do" — alert and fail the run
    console.error("[cron/org-purge] Candidate query failed:", err);
    Sentry.captureException(err, {
      tags: { cron: "org-purge", step: "candidates" },
    });
    return NextResponse.json(
      { error: "Candidate query failed" },
      { status: 500 },
    );
  }

  if (candidateOrgs.length === 0) {
    console.log("[cron/org-purge] No orgs due for purge");
    return NextResponse.json({
      message: "No orgs due for purge",
      processed: 0,
      failed: 0,
      retriedStale: 0,
    });
  }

  const client = await clerkClient();
  let purged = 0;
  let failed = 0;
  let retriedStale = 0;

  for (const candidate of candidateOrgs) {
    // Which step is running — reported to Sentry if the org fails
    let step: "claim" | "clerk" | "db" = "claim";

    try {
      // Atomic claim — only succeeds if the org is still actually eligible
      // right now. If an admin cancelled between the query above and this
      // update, deletionRequestedAt is null and the claim returns nothing.
      // A second overlapping run cannot take over the same stale claim: the first
      // takeover sets purgingAt to now, so the stale condition no longer matches.
      const claimed = await db
        .update(orgs)
        .set({ purgingAt: new Date() })
        .where(and(eq(orgs.id, candidate.id), eligible))
        .returning({ id: orgs.id });

      if (claimed.length === 0) {
        console.log(
          `[cron/org-purge] Org ${candidate.id} no longer eligible — skipped`,
        );
        continue;
      }

      // The org already had a claim, so this run took over an abandoned one
      if (candidate.purgingAt !== null) {
        retriedStale++;
        console.warn(
          `[cron/org-purge] Took over an abandoned claim on org ${candidate.id}`,
        );
      }

      // Delete Clerk first. If this throws, the claim is KEPT on purpose (releasing it could let
      // cancelOrgDeletion "restore" an org that is already gone from Clerk) — the failure is
      // reported below and the next run takes the claim over once it is stale.
      step = "clerk";
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
      step = "db";
      await db.transaction(async (tx) => {
        await tx.delete(orgs).where(eq(orgs.id, candidate.id));
      });

      purged++;
    } catch (err) {
      failed++;
      console.error(
        `[cron/org-purge] Failed to purge org ${candidate.id} (step: ${step}):`,
        err,
      );
      // Ids only — never content. The step tag shows where it stopped.
      Sentry.captureException(err, {
        tags: { cron: "org-purge", step },
        extra: { orgId: candidate.id, action: "org-purge" },
      });
    }
  }

  console.log(
    `[cron/org-purge] Purged ${purged} orgs, ${failed} failed, ${retriedStale} took over a stale claim`,
  );
  return NextResponse.json({
    message: "Org purge run complete",
    processed: purged,
    failed,
    retriedStale,
  });
}
