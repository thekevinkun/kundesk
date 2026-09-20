// Knowledge queries used for plan-limit enforcement and write locking
// Same transaction-handle pattern as lib/db/queries/documents.ts

import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  businessProfiles,
  knowledgeEntries,
  knowledgeSections,
  orgs,
} from "@/lib/db/schema";
import { compileProfileBlock } from "@/helpers/knowledge";
import type { PlanName } from "@/types/billing";

// Extracted from db.transaction's own callback signature — always matches the real driver types
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | DbTransaction;

// Counts every entry of the org — disabled ones too, they still occupy a slot
export async function getOrgKnowledgeEntryCount(
  orgId: string,
  dbOrTx: DbOrTx = db,
): Promise<number> {
  const [result] = await dbOrTx
    .select({ total: count() })
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.orgId, orgId));

  return result?.total ?? 0;
}

// Counts the org's sections
export async function getOrgKnowledgeSectionCount(
  orgId: string,
  dbOrTx: DbOrTx = db,
): Promise<number> {
  const [result] = await dbOrTx
    .select({ total: count() })
    .from(knowledgeSections)
    .where(eq(knowledgeSections.orgId, orgId));

  return result?.total ?? 0;
}

// Locks the org row until the transaction ends — serializes concurrent creates from the same org,
// so a limit check + insert can never both pass on a stale count (same idea as the upload route)
// Returns the plan, or null when the org doesn't exist
export async function lockOrgForKnowledgeWrite(
  tx: DbTransaction,
  orgId: string,
): Promise<PlanName | null> {
  const [locked] = await tx
    .select({ plan: orgs.plan })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .for("update");

  return locked ? (locked.plan as PlanName) : null;
}

// Reads the org's business profile and compiles it into the block injected in the system prompt
// Returns null when the org has no profile row or filled in nothing
export async function getBusinessProfileBlock(
  orgId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      about: businessProfiles.about,
      address: businessProfiles.address,
      contacts: businessProfiles.contacts,
      hours: businessProfiles.hours,
      paymentMethods: businessProfiles.paymentMethods,
    })
    .from(businessProfiles)
    .where(eq(businessProfiles.orgId, orgId)) // ← tenant scoping
    .limit(1);

  return row ? compileProfileBlock(row) : null;
}
