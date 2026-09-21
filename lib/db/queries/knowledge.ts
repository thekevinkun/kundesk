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
import { parseStoredHours } from "@/helpers/knowledge-schemas";
import type { PlanName } from "@/types/billing";
import type { ProfileData } from "@/types/knowledge";

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

// Reads the org's business profile: the compiled text block AND the raw hours.
// The raw hours are needed because open/closed is computed on every chat request.
export async function getBusinessProfileData(
  orgId: string,
): Promise<ProfileData> {
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

  if (!row) return { block: null, hours: [] };

  // Stored hours may predate a format change or have been edited by hand in Neon.
  // Keep only what passes the save rules, so one bad schedule can't take the whole profile down.
  const { hours, dropped } = parseStoredHours(row.hours);
  if (dropped > 0) {
    console.warn(
      `[knowledge] Dropped ${dropped} unreadable schedule(s) for org ${orgId}`,
    );
  }

  return { block: compileProfileBlock({ ...row, hours }), hours };
}
