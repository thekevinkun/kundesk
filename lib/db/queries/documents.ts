// Document-related queries used for plan-limit enforcement
// Separate from lib/actions/chatbot.ts's getDocumentCount, which is
// ready-only and built for the sidebar badge, not enforcement

import { count, eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

// Counts documents that occupy a plan quota slot right now.
// Includes "processing" — a doc mid-pipeline already consumed an upload slot,
// so excluding it would let users blow past their limit by uploading faster
// than the pipeline can finish. Excludes "failed" — a failed doc never made
// it into the knowledge base and shouldn't count against the org's limit.
export async function getOrgDocumentUsageCount(orgId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        inArray(documents.status, ["processing", "ready"]),
      ),
    );

  return result?.total ?? 0;
}
