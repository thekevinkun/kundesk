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
import type {
  CompileProfile,
  KnowledgeSectionRow,
  ProfileData,
} from "@/types/knowledge";

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

// Reads the org's full business profile for the dashboard edit form — unlike
// getBusinessProfileData (compiled block + hours only, used by chat), this
// returns every raw field so the form can pre-fill and let the owner edit them.
export async function getBusinessProfileForEdit(
  orgId: string,
): Promise<CompileProfile> {
  const [row] = await db
    .select({
      about: businessProfiles.about,
      address: businessProfiles.address,
      contacts: businessProfiles.contacts,
      hours: businessProfiles.hours,
      paymentMethods: businessProfiles.paymentMethods,
    })
    .from(businessProfiles)
    .where(eq(businessProfiles.orgId, orgId))
    .limit(1);

  if (!row) {
    return {
      about: null,
      address: null,
      contacts: [],
      hours: [],
      paymentMethods: [],
    };
  }

  // Same drop-whole-bad-schedule protection as getBusinessProfileData — a
  // hand-edited or legacy-format schedule must not crash the edit form either
  const { hours, dropped } = parseStoredHours(row.hours);
  if (dropped > 0) {
    console.warn(
      `[knowledge] Dropped ${dropped} unreadable schedule(s) for org ${orgId} (edit form)`,
    );
  }

  return {
    about: row.about,
    address: row.address,
    contacts: row.contacts,
    hours,
    paymentMethods: row.paymentMethods,
  };
}

// Reads every section + its entries for the dashboard's Katalog & FAQ tab.
// Two queries instead of a JOIN — a JOIN would repeat every section row once
// per entry, wasteful once a catalog section has ~190 entries (rule 184).
export async function getKnowledgeSectionsWithEntries(
  orgId: string,
): Promise<KnowledgeSectionRow[]> {
  const sectionRows = await db
    .select({
      id: knowledgeSections.id,
      kind: knowledgeSections.kind,
      title: knowledgeSections.title,
      note: knowledgeSections.note,
      sortOrder: knowledgeSections.sortOrder,
    })
    .from(knowledgeSections)
    .where(eq(knowledgeSections.orgId, orgId))
    .orderBy(knowledgeSections.sortOrder);

  const entryRows = await db
    .select({
      id: knowledgeEntries.id,
      sectionId: knowledgeEntries.sectionId,
      title: knowledgeEntries.title,
      body: knowledgeEntries.body,
      price: knowledgeEntries.price,
      isAvailable: knowledgeEntries.isAvailable,
      sortOrder: knowledgeEntries.sortOrder,
      syncStatus: knowledgeEntries.syncStatus,
    })
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.orgId, orgId))
    .orderBy(knowledgeEntries.sortOrder);

  return sectionRows.map((section) => ({
    ...section,
    entries: entryRows
      .filter((e) => e.sectionId === section.id)
      .map((e) => ({
        id: e.id,
        title: e.title,
        body: e.body,
        price: e.price,
        isAvailable: e.isAvailable,
        sortOrder: e.sortOrder,
        syncStatus: e.syncStatus,
      })),
  }));
}

// CHECK FOR AN EXISTING EQUIVALENT (e.g. lib/db/queries/billing.ts) BEFORE
// MERGING — added here only because this file already imports `orgs` for
// lockOrgForKnowledgeWrite and I have no visibility into the billing queries.
export async function getOrgPlan(orgId: string): Promise<PlanName> {
  const [row] = await db
    .select({ plan: orgs.plan })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  return (row?.plan as PlanName) ?? "free";
}
