"use server";

// Server Actions for structured business knowledge (form-based alternative to document upload)
// Every action: admin only → rate limited → Zod validated → org-scoped → saved as "stale" → synced
// Write contract: see lib/knowledge/sync.ts

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth";
import {
  businessProfiles,
  chunks,
  knowledgeEntries,
  knowledgeSections,
} from "@/lib/db/schema";
import { cacheDelete, CacheKeys, checkKnowledgeWriteLimit } from "@/lib/redis";
import {
  getOrgKnowledgeEntryCount,
  getOrgKnowledgeSectionCount,
  lockOrgForKnowledgeWrite,
} from "@/lib/db/queries/knowledge";
import { syncEntry, syncSection } from "@/lib/knowledge/sync";
import { compileProfileBlock, toSyncStatus } from "@/helpers/knowledge";
import {
  createEntrySchema,
  createSectionSchema,
  idOnlySchema,
  saveProfileSchema,
  setEntryAvailabilitySchema,
  updateEntrySchema,
  updateSectionSchema,
} from "@/helpers/knowledge-schemas";
import { PLAN_LIMITS } from "@/types/billing";
import type { ActionResult } from "@/types/api";
import {
  MAX_KNOWLEDGE_SECTIONS,
  MAX_PROFILE_BLOCK_CHARS,
} from "@/types/knowledge";
import type {
  EntrySaveData,
  RetrySyncData,
  SyncStatusData,
} from "@/types/knowledge";

// Route the dashboard UI will use — revalidating a route that doesn't exist yet is harmless
const KNOWLEDGE_PATH = "/dashboard/knowledge";

// Retry work per call — each section sync is one OpenAI round trip, and Vercel free caps a function at 10s
const MAX_RETRY_SECTIONS_PER_CALL = 3;

// Marks an error message as safe to show the owner. Anything NOT thrown as this class
// becomes a generic message, so internal DB/OpenAI text never reaches the browser.
class KnowledgeUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeUserError";
  }
}

// First validation message — same approach as chatbot.ts
function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Input tidak valid";
}

// Shared wrapper: admin only → rate limited → errors handled in one place
// requireOrgAdmin() stays OUTSIDE the try so an unauthorized call throws like every other mutation
// (and doesn't flood Sentry)
async function runWrite<T>(
  name: string,
  fn: (orgId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const { orgId } = await requireOrgAdmin();

  try {
    const limit = await checkKnowledgeWriteLimit(orgId);
    if (!limit.success) {
      return {
        success: false,
        error: "Terlalu banyak perubahan. Coba lagi dalam beberapa saat.",
      };
    }

    return await fn(orgId);
  } catch (err) {
    // Expected failures (limits, not found) carry a safe message
    if (err instanceof KnowledgeUserError) {
      return { success: false, error: err.message };
    }

    console.error(`[knowledge/${name}] failed:`, err);
    Sentry.captureException(err, { extra: { orgId, action: name } });
    return { success: false, error: "Terjadi kesalahan. Coba lagi." };
  }
}

// ─── Sections ───

export async function createSection(
  rawInput: unknown,
): Promise<ActionResult<{ id: number }>> {
  return runWrite("createSection", async (orgId) => {
    const parsed = createSectionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { kind, title, note } = parsed.data;

    const id = await db.transaction(async (tx) => {
      // Lock first — two concurrent creates must not both pass the limit check
      const plan = await lockOrgForKnowledgeWrite(tx, orgId);
      if (!plan) throw new KnowledgeUserError("Organisasi tidak ditemukan");

      const total = await getOrgKnowledgeSectionCount(orgId, tx);
      if (total >= MAX_KNOWLEDGE_SECTIONS) {
        throw new KnowledgeUserError(
          `Maksimal ${MAX_KNOWLEDGE_SECTIONS} bagian per bisnis.`,
        );
      }

      // New sections go to the end of the list
      const [last] = await tx
        .select({ value: max(knowledgeSections.sortOrder) })
        .from(knowledgeSections)
        .where(eq(knowledgeSections.orgId, orgId));

      const [row] = await tx
        .insert(knowledgeSections)
        .values({
          orgId,
          kind,
          title,
          note,
          sortOrder: (last?.value ?? -1) + 1,
        })
        .returning({ id: knowledgeSections.id });

      if (!row) throw new Error("INSERT_FAILED");
      return row.id;
    });

    revalidatePath(KNOWLEDGE_PATH);
    return { success: true, data: { id } };
  });
}

// Title, note, and kind appear inside EVERY entry chunk of the section,
// so a real change rebuilds the whole section
export async function updateSection(
  rawInput: unknown,
): Promise<ActionResult<SyncStatusData>> {
  return runWrite("updateSection", async (orgId) => {
    const parsed = updateSectionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { id, kind, title, note } = parsed.data;

    const [existing] = await db
      .select({
        kind: knowledgeSections.kind,
        title: knowledgeSections.title,
        note: knowledgeSections.note,
      })
      .from(knowledgeSections)
      .where(
        and(eq(knowledgeSections.id, id), eq(knowledgeSections.orgId, orgId)),
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: "Bagian tidak ditemukan" };
    }

    // Same values as before — no rewrite needed. But an earlier failed sync may have left
    // entries stale, so never report "synced" without looking.
    if (
      existing.kind === kind &&
      existing.title === title &&
      existing.note === note
    ) {
      const [staleEntry] = await db
        .select({ id: knowledgeEntries.id })
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.sectionId, id),
            eq(knowledgeEntries.orgId, orgId),
            eq(knowledgeEntries.syncStatus, "stale"),
          ),
        )
        .limit(1);

      // Everything is really in sync — skip the embedding round trip
      if (!staleEntry) {
        return { success: true, data: { syncStatus: "synced" } };
      }

      // Stale entries exist: pressing save again acts as a retry, without rewriting the section
      const retry = await syncSection(orgId, id);
      revalidatePath(KNOWLEDGE_PATH);
      return { success: true, data: { syncStatus: toSyncStatus(retry) } };
    }

    // Save + flag every entry of the section as stale in one transaction
    await db.transaction(async (tx) => {
      await tx
        .update(knowledgeSections)
        .set({ kind, title, note, updatedAt: new Date() })
        .where(
          and(eq(knowledgeSections.id, id), eq(knowledgeSections.orgId, orgId)),
        );

      await tx
        .update(knowledgeEntries)
        .set({ syncStatus: "stale" })
        .where(
          and(
            eq(knowledgeEntries.sectionId, id),
            eq(knowledgeEntries.orgId, orgId),
          ),
        );
    });

    const result = await syncSection(orgId, id);

    revalidatePath(KNOWLEDGE_PATH);
    return { success: true, data: { syncStatus: toSyncStatus(result) } };
  });
}

// One DELETE — foreign keys cascade to the section's entries and all their chunks
export async function deleteSection(rawInput: unknown): Promise<ActionResult> {
  return runWrite("deleteSection", async (orgId) => {
    const parsed = idOnlySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const deleted = await db
      .delete(knowledgeSections)
      .where(
        and(
          eq(knowledgeSections.id, parsed.data.id),
          eq(knowledgeSections.orgId, orgId),
        ),
      )
      .returning({ id: knowledgeSections.id });

    if (deleted.length === 0) {
      return { success: false, error: "Bagian tidak ditemukan" };
    }

    revalidatePath(KNOWLEDGE_PATH);
    return { success: true, data: undefined };
  });
}

// ─── Entries ───

export async function createEntry(
  rawInput: unknown,
): Promise<ActionResult<EntrySaveData>> {
  return runWrite("createEntry", async (orgId) => {
    const parsed = createEntrySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { sectionId, title, body, price, isAvailable } = parsed.data;

    const id = await db.transaction(async (tx) => {
      // Lock the org row, then count — the count is guaranteed to include any insert
      // committed by a request that held the lock before us
      const plan = await lockOrgForKnowledgeWrite(tx, orgId);
      if (!plan) throw new KnowledgeUserError("Organisasi tidak ditemukan");

      const used = await getOrgKnowledgeEntryCount(orgId, tx);
      if (used >= PLAN_LIMITS[plan].knowledgeEntries) {
        throw new KnowledgeUserError(
          "Batas entri tercapai. Upgrade plan untuk menambah lebih banyak.",
        );
      }

      // The section must belong to this org — same "not found" whether missing or foreign
      const [section] = await tx
        .select({ kind: knowledgeSections.kind })
        .from(knowledgeSections)
        .where(
          and(
            eq(knowledgeSections.id, sectionId),
            eq(knowledgeSections.orgId, orgId),
          ),
        )
        .limit(1);

      if (!section) throw new KnowledgeUserError("Bagian tidak ditemukan");

      const [last] = await tx
        .select({ value: max(knowledgeEntries.sortOrder) })
        .from(knowledgeEntries)
        .where(eq(knowledgeEntries.sectionId, sectionId));

      const [row] = await tx
        .insert(knowledgeEntries)
        .values({
          orgId,
          sectionId,
          title,
          body,
          // FAQ entries have no price — drop it even if the client sent one
          price: section.kind === "faq" ? null : price,
          isAvailable,
          sortOrder: (last?.value ?? -1) + 1,
          // Chunks don't exist yet — stays "stale" until the sync below succeeds
          syncStatus: "stale",
        })
        .returning({ id: knowledgeEntries.id });

      if (!row) throw new Error("INSERT_FAILED");
      return row.id;
    });

    const result = await syncEntry(orgId, id);

    revalidatePath(KNOWLEDGE_PATH);
    return {
      success: true,
      data: { id, syncStatus: toSyncStatus(result) },
    };
  });
}

// Fields an entry save can change
type EntryChanges = Partial<
  Pick<
    typeof knowledgeEntries.$inferInsert,
    "title" | "body" | "price" | "isAvailable"
  >
>;

// Shared by updateEntry and setEntryAvailability:
// write + flag stale + bump updatedAt in ONE statement, THEN sync (the contract from sync.ts)
async function saveEntryChanges(
  orgId: string,
  entryId: number,
  changes: EntryChanges,
): Promise<ActionResult<EntrySaveData>> {
  // Scoped to the org; also gives us the section kind for the FAQ price rule
  const [found] = await db
    .select({ sectionKind: knowledgeSections.kind })
    .from(knowledgeEntries)
    .innerJoin(
      knowledgeSections,
      eq(knowledgeSections.id, knowledgeEntries.sectionId),
    )
    .where(
      and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.orgId, orgId)),
    )
    .limit(1);

  if (!found) {
    return { success: false, error: "Entri tidak ditemukan" };
  }

  const values: EntryChanges & { syncStatus: "stale"; updatedAt: Date } = {
    ...changes,
    syncStatus: "stale",
    updatedAt: new Date(),
  };
  // FAQ entries have no price
  if (found.sectionKind === "faq" && "price" in changes) values.price = null;

  const updated = await db
    .update(knowledgeEntries)
    .set(values)
    .where(
      and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.orgId, orgId)),
    )
    .returning({ id: knowledgeEntries.id });

  if (updated.length === 0) {
    return { success: false, error: "Entri tidak ditemukan" };
  }

  const result = await syncEntry(orgId, entryId);

  revalidatePath(KNOWLEDGE_PATH);
  return {
    success: true,
    data: { id: entryId, syncStatus: toSyncStatus(result) },
  };
}

export async function updateEntry(
  rawInput: unknown,
): Promise<ActionResult<EntrySaveData>> {
  return runWrite("updateEntry", async (orgId) => {
    const parsed = updateEntrySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { id, title, body, price, isAvailable } = parsed.data;

    return saveEntryChanges(orgId, id, { title, body, price, isAvailable });
  });
}

// The "Habis hari ini" toggle — the most frequent edit an owner will make
export async function setEntryAvailability(
  rawInput: unknown,
): Promise<ActionResult<EntrySaveData>> {
  return runWrite("setEntryAvailability", async (orgId) => {
    const parsed = setEntryAvailabilitySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    return saveEntryChanges(orgId, parsed.data.id, {
      isAvailable: parsed.data.isAvailable,
    });
  });
}

export async function deleteEntry(
  rawInput: unknown,
): Promise<ActionResult<SyncStatusData>> {
  return runWrite("deleteEntry", async (orgId) => {
    const parsed = idOnlySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const sectionId = await db.transaction(async (tx) => {
      // The entry's own chunks go away through the foreign-key cascade
      const [deleted] = await tx
        .delete(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.id, parsed.data.id),
            eq(knowledgeEntries.orgId, orgId),
          ),
        )
        .returning({ sectionId: knowledgeEntries.sectionId });

      if (!deleted) return null;

      // The section summary still lists the deleted item. Flag the remaining entries stale
      // so a failed rebuild stays visible and retryable instead of leaving a wrong list behind.
      const remaining = await tx
        .update(knowledgeEntries)
        .set({ syncStatus: "stale" })
        .where(
          and(
            eq(knowledgeEntries.sectionId, deleted.sectionId),
            eq(knowledgeEntries.orgId, orgId),
          ),
        )
        .returning({ id: knowledgeEntries.id });

      // With fewer than 2 entries left there is no summary list at all. Delete it in THIS
      // transaction: with zero entries left there'd be no stale row for a retry to find.
      if (remaining.length < 2) {
        await tx
          .delete(chunks)
          .where(
            and(
              eq(chunks.orgId, orgId),
              eq(chunks.sectionId, deleted.sectionId),
            ),
          );
      }

      return deleted.sectionId;
    });

    if (sectionId === null) {
      return { success: false, error: "Entri tidak ditemukan" };
    }

    // Rebuild the section: fixes the summary list and flips the entries back to "synced"
    const result = await syncSection(orgId, sectionId);

    revalidatePath(KNOWLEDGE_PATH);
    return { success: true, data: { syncStatus: toSyncStatus(result) } };
  });
}

// ─── Business profile ───

export async function saveBusinessProfile(
  rawInput: unknown,
): Promise<ActionResult> {
  return runWrite("saveBusinessProfile", async (orgId) => {
    const parsed = saveProfileSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const profile = parsed.data;

    // The compiled block is added to the system prompt on EVERY chat message — cap its size
    const block = compileProfileBlock(profile);
    if (block && block.length > MAX_PROFILE_BLOCK_CHARS) {
      return {
        success: false,
        error:
          "Profil terlalu panjang. Persingkat teks atau kurangi jumlah jadwal dan kontak.",
      };
    }

    // One profile row per org — insert the first time, update afterwards
    await db
      .insert(businessProfiles)
      .values({ orgId, ...profile })
      .onConflictDoUpdate({
        target: businessProfiles.orgId,
        set: { ...profile, updatedAt: new Date() },
      });

    // Chat reads the profile through a cache (added in a later PR) — clear it now.
    // Don't fail an already-committed write if Redis is down; the TTL will expire stale data.
    try {
      await cacheDelete(CacheKeys.profile(orgId));
    } catch (err) {
      console.error("Failed to invalidate profile cache", err);
    }

    revalidatePath(KNOWLEDGE_PATH);
    return { success: true, data: undefined };
  });
}

// ─── Repair ───

// Rebuilds sections that still have "stale" entries (e.g. OpenAI was down during a save)
// A few sections per call — the UI calls again while remaining > 0
export async function retryStaleKnowledgeSync(): Promise<
  ActionResult<RetrySyncData>
> {
  return runWrite("retryStaleKnowledgeSync", async (orgId) => {
    const staleSections = await db
      .selectDistinct({ sectionId: knowledgeEntries.sectionId })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.orgId, orgId),
          eq(knowledgeEntries.syncStatus, "stale"),
        ),
      );

    let synced = 0;
    for (const { sectionId } of staleSections.slice(
      0,
      MAX_RETRY_SECTIONS_PER_CALL,
    )) {
      const result = await syncSection(orgId, sectionId);
      if (result.status === "synced") synced += 1;
    }

    revalidatePath(KNOWLEDGE_PATH);
    return {
      success: true,
      data: { synced, remaining: staleSections.length - synced },
    };
  });
}
