// Document-related queries used for plan-limit enforcement
// Separate from lib/actions/chatbot.ts's getDocumentCount, which is
// ready-only and built for the sidebar badge, not enforcement

import { count, eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

// Accepts either the module-level db client or an active transaction handle.
// Passing the tx here is required for callers doing a locked count-then-insert
// (see api/documents/upload/route.ts) — using the module db instead would run
// the count on a separate connection, outside the lock, defeating its purpose.
// Extracted directly from db.transaction's own callback signature — this always
// matches the real driver/schema types, no hand-written generics, zero `any`.
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Transaction;

// Counts documents that occupy a plan quota slot right now.
// Includes "processing" — a doc mid-pipeline already consumed an upload slot,
// so excluding it would let users blow past their limit by uploading faster
// than the pipeline can finish. Excludes "failed" — a failed doc never made
// it into the knowledge base and shouldn't count against the org's limit.
export async function getOrgDocumentUsageCount(
  orgId: string,
  dbOrTx: DbOrTx = db,
): Promise<number> {
  const [result] = await dbOrTx
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
