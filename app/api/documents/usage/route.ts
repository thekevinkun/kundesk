// Returns the org's current document usage against their plan limit
// Used by DocumentsPage to show a "X / Y documents used" banner and
// to disable/warn on upload before the user even tries and hits the 403

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { getOrgDocumentUsageCount } from "@/lib/db/queries/documents";
import { PLAN_LIMITS, type PlanName } from "@/types/billing";
import type { ApiResponse } from "@/types/api";

interface DocumentUsageData {
  used: number;
  limit: number | null; // null means unlimited (Pro plan)
}

export async function GET(): Promise<NextResponse> {
  // Guard — scopes query to authenticated org
  const { orgId } = await requireOrg();

  // Fresh read — same principle as the upload route's gate, this endpoint
  // exists specifically to reflect current state, not a cached snapshot
  const [org] = await db
    .select({ plan: orgs.plan })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  if (!org) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Organization not found", status: 404 },
      { status: 404 },
    );
  }

  const used = await getOrgDocumentUsageCount(orgId);
  const rawLimit = PLAN_LIMITS[org.plan as PlanName].documents;

  // Infinity isn't valid JSON — JSON.stringify silently turns it into null.
  // Converting explicitly here documents the intent instead of leaving it
  // as an implicit serialization quirk for whoever reads this route later.
  const limit = rawLimit === Infinity ? null : rawLimit;

  return NextResponse.json<ApiResponse<DocumentUsageData>>({
    ok: true,
    data: { used, limit },
  });
}
