// Writes structured knowledge into the RAG index:
// load → compile → embed (outside any lock) → swap chunks in ONE transaction
// Contract with callers (Server Actions): every content write must set syncStatus "stale"
// and updatedAt = now in the same UPDATE, THEN call a sync function below.

import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { chunks, knowledgeEntries, knowledgeSections } from "@/lib/db/schema";
import { embedTexts } from "@/lib/ai/embed";
import { buildSectionSnapshot, buildSyncItems } from "@/helpers/knowledge";
import type { SyncResult } from "@/types/knowledge";

type ChunkInsert = typeof chunks.$inferInsert;

// Rebuilds chunks for ONE section.
// scope "all" = every entry + summary, number[] = those entries + summary, [] = summary only
async function syncSectionChunks(
  orgId: string,
  sectionId: number,
  scope: "all" | number[],
): Promise<SyncResult> {
  // Step 1 — load the section and its entries, always scoped to the org
  const [section] = await db
    .select()
    .from(knowledgeSections)
    .where(
      and(
        eq(knowledgeSections.id, sectionId),
        eq(knowledgeSections.orgId, orgId),
      ),
    )
    .limit(1);

  if (!section) return { status: "not_found" };

  const entries = await db
    .select()
    .from(knowledgeEntries)
    .where(
      and(
        eq(knowledgeEntries.sectionId, sectionId),
        eq(knowledgeEntries.orgId, orgId),
      ),
    )
    .orderBy(asc(knowledgeEntries.sortOrder), asc(knowledgeEntries.id));

  // Entries deleted since the caller asked simply drop out of the target list
  const existingIds = entries.map((entry) => entry.id);
  const targetIds =
    scope === "all"
      ? existingIds
      : scope.filter((id) => existingIds.includes(id));

  // Fingerprint of what we just read — compared again inside the transaction
  const snapshot = buildSectionSnapshot(section, entries);
  const items = buildSyncItems(section, entries, targetIds, sectionId);

  // Step 2 — embed BEFORE the transaction: a slow OpenAI call must never hold a DB lock
  let embeddings: number[][];
  try {
    embeddings = await embedTexts(items.map((item) => item.content));
  } catch (err) {
    // Old chunks stay untouched (still searchable) and entries are already "stale"
    // Only ids go to Sentry — never content
    console.error("[knowledge/sync] Embedding failed:", err);
    Sentry.captureException(err, { extra: { orgId, sectionId } });
    return { status: "embed_failed" };
  }

  const rows: ChunkInsert[] = items.map((item, i) => ({
    orgId,
    entryId: item.entryId,
    sectionId: item.sectionId,
    content: item.content,
    // Same storage format as document chunks: vector serialized as a JSON string
    embedding: JSON.stringify(embeddings[i]),
  }));

  // Step 3 — swap old chunks for new ones atomically
  const outcome = await db.transaction(async (tx) => {
    // Lock the section row — two syncs of the same section queue here instead of interleaving
    const [lockedSection] = await tx
      .select({ updatedAt: knowledgeSections.updatedAt })
      .from(knowledgeSections)
      .where(
        and(
          eq(knowledgeSections.id, sectionId),
          eq(knowledgeSections.orgId, orgId),
        ),
      )
      .for("update");

    if (!lockedSection) return "not_found" as const;

    // Lock the entry rows too — a save landing mid-swap waits until we commit, so we can never
    // mark an entry "synced" that someone just changed. Re-read them for the fingerprint check.
    const lockedEntries = await tx
      .select({
        id: knowledgeEntries.id,
        updatedAt: knowledgeEntries.updatedAt,
      })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.sectionId, sectionId),
          eq(knowledgeEntries.orgId, orgId),
        ),
      )
      .for("update");

    // Something changed while we were embedding — our chunks would be outdated.
    // Back off; the save that changed it runs its own sync with fresh data.
    if (buildSectionSnapshot(lockedSection, lockedEntries) !== snapshot) {
      return "superseded" as const;
    }

    // Old chunks: those of the target entries + this section's summary chunks
    // (or() is skipped when there are no target entries — inArray with [] is not safe)
    const ownerFilter =
      targetIds.length > 0
        ? or(
            inArray(chunks.entryId, targetIds),
            eq(chunks.sectionId, sectionId),
          )
        : eq(chunks.sectionId, sectionId);

    await tx.delete(chunks).where(and(eq(chunks.orgId, orgId), ownerFilter));

    if (rows.length > 0) {
      await tx.insert(chunks).values(rows);
    }

    // Mark rebuilt entries as in sync — deliberately does NOT touch updatedAt
    if (targetIds.length > 0) {
      await tx
        .update(knowledgeEntries)
        .set({ syncStatus: "synced" })
        .where(
          and(
            eq(knowledgeEntries.orgId, orgId),
            inArray(knowledgeEntries.id, targetIds),
          ),
        );
    }

    return "synced" as const;
  });

  if (outcome === "synced") {
    return { status: "synced", chunkCount: rows.length };
  }
  return { status: outcome };
}

// After saving one entry: rebuild its chunks + the section summary
export async function syncEntry(
  orgId: string,
  entryId: number,
): Promise<SyncResult> {
  // Look up the entry's section, scoped to the org — same "not found" whether missing or foreign
  const [entry] = await db
    .select({ sectionId: knowledgeEntries.sectionId })
    .from(knowledgeEntries)
    .where(
      and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.orgId, orgId)),
    )
    .limit(1);

  if (!entry) return { status: "not_found" };
  return syncSectionChunks(orgId, entry.sectionId, [entryId]);
}

// After a section's title / note / kind changes (every entry chunk contains them),
// and for retrying failed syncs and bulk import
export function syncSection(
  orgId: string,
  sectionId: number,
): Promise<SyncResult> {
  return syncSectionChunks(orgId, sectionId, "all");
}

// After an entry is deleted or reordered: only the section summary needs rebuilding
// (the deleted entry's own chunks are removed by the FK cascade)
export function syncSectionSummary(
  orgId: string,
  sectionId: number,
): Promise<SyncResult> {
  return syncSectionChunks(orgId, sectionId, []);
}
