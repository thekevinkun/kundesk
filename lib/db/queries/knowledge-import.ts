// Queries used by catalog import — all scoped by org_id, all accept a transaction handle
// so the save action can run them under the org lock (same pattern as queries/knowledge.ts)

import { and, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeEntries, knowledgeSections } from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db/queries/knowledge";
import type { ImportRow, SectionKind } from "@/types/knowledge";

type DbOrTx = typeof db | DbTransaction;

// The section's kind, or null when it doesn't exist OR belongs to another org (same answer for both)
export async function getSectionKind(
  orgId: string,
  sectionId: number,
  dbOrTx: DbOrTx = db,
): Promise<SectionKind | null> {
  const [row] = await dbOrTx
    .select({ kind: knowledgeSections.kind })
    .from(knowledgeSections)
    .where(
      and(
        eq(knowledgeSections.id, sectionId),
        eq(knowledgeSections.orgId, orgId), // ← tenant scoping
      ),
    )
    .limit(1);

  return row?.kind ?? null;
}

// Every entry title in the section — used to spot duplicates
export async function getSectionEntryTitles(
  orgId: string,
  sectionId: number,
  dbOrTx: DbOrTx = db,
): Promise<string[]> {
  const rows = await dbOrTx
    .select({ title: knowledgeEntries.title })
    .from(knowledgeEntries)
    .where(
      and(
        eq(knowledgeEntries.sectionId, sectionId),
        eq(knowledgeEntries.orgId, orgId),
      ),
    );

  return rows.map((row) => row.title);
}

// Next free sortOrder in the section — new entries go to the end of the list
export async function getNextEntrySortOrder(
  orgId: string,
  sectionId: number,
  dbOrTx: DbOrTx = db,
): Promise<number> {
  const [last] = await dbOrTx
    .select({ value: max(knowledgeEntries.sortOrder) })
    .from(knowledgeEntries)
    .where(
      and(
        eq(knowledgeEntries.sectionId, sectionId),
        eq(knowledgeEntries.orgId, orgId),
      ),
    );

  return (last?.value ?? -1) + 1;
}

// Inserts a batch of reviewed rows in ONE statement. Every row starts "stale" — its chunks
// don't exist yet, so it stays stale until the sync after the transaction succeeds.
// The description goes into `body`. Returns the new entry ids in row order.
export async function insertImportedEntries(
  tx: DbTransaction,
  orgId: string,
  sectionId: number,
  rows: ImportRow[],
  firstSortOrder: number,
): Promise<number[]> {
  if (rows.length === 0) return [];

  const inserted = await tx
    .insert(knowledgeEntries)
    .values(
      rows.map((row, index) => ({
        orgId,
        sectionId,
        title: row.title,
        body: row.description,
        price: row.price,
        isAvailable: true,
        sortOrder: firstSortOrder + index,
        syncStatus: "stale" as const,
      })),
    )
    .returning({ id: knowledgeEntries.id });

  return inserted.map((row) => row.id);
}
