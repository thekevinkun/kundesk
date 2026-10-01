// Read-only health checks for the knowledge sync layer (rule 201 detection)
// Never writes — only finds rows that look wrong so the cron can report them

import { and, eq, notExists, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chunks, knowledgeEntries, knowledgeSections } from "@/lib/db/schema";

// Cap on rows returned per check — keeps the Sentry payload small
const MAX_FINDINGS = 50;

// Ids and counts only — never content, same rule as sync.ts
export type SummaryGap = { sectionId: number; orgId: string; entries: number };
export type EntryGap = { entryId: number; orgId: string; sectionId: number };

// Check 1 (the rule 201 symptom): catalog section, 2+ entries, all synced, zero summary chunks
// The 10-minute window skips sections a sync may still be working on
export async function findSectionsMissingSummary(): Promise<SummaryGap[]> {
  return (
    db
      .select({
        sectionId: knowledgeSections.id,
        orgId: knowledgeSections.orgId,
        entries: sql<number>`count(${knowledgeEntries.id})::int`,
      })
      .from(knowledgeSections)
      .innerJoin(
        knowledgeEntries,
        eq(knowledgeEntries.sectionId, knowledgeSections.id),
      )
      // Only catalog sections ever get summary chunks (compileSectionSummaryChunks)
      .where(eq(knowledgeSections.kind, "catalog"))
      .groupBy(knowledgeSections.id, knowledgeSections.orgId)
      .having(
        sql`count(${knowledgeEntries.id}) >= 2
        AND count(*) FILTER (WHERE ${knowledgeEntries.syncStatus} <> 'synced') = 0
        AND max(${knowledgeEntries.updatedAt}) < now() - interval '10 minutes'
        AND NOT EXISTS (SELECT 1 FROM ${chunks} WHERE ${chunks.sectionId} = ${knowledgeSections.id})`,
      )
      .limit(MAX_FINDINGS)
  );
}

// Check 2: a synced entry that should own a chunk but has none
// Catalog entries always have one; other kinds only while available
export async function findSyncedEntriesMissingChunks(): Promise<EntryGap[]> {
  return db
    .select({
      entryId: knowledgeEntries.id,
      orgId: knowledgeEntries.orgId,
      sectionId: knowledgeEntries.sectionId,
    })
    .from(knowledgeEntries)
    .innerJoin(
      knowledgeSections,
      eq(knowledgeSections.id, knowledgeEntries.sectionId),
    )
    .where(
      and(
        eq(knowledgeEntries.syncStatus, "synced"),
        sql`${knowledgeEntries.updatedAt} < now() - interval '10 minutes'`,
        or(
          eq(knowledgeSections.kind, "catalog"),
          eq(knowledgeEntries.isAvailable, true),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(chunks)
            .where(eq(chunks.entryId, knowledgeEntries.id)),
        ),
      ),
    )
    .limit(MAX_FINDINGS);
}
