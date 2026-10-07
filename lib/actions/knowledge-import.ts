"use server";

// Server Actions for catalog import (paste text → candidate rows → owner reviews → save).
// Two steps on purpose: extraction saves NOTHING, and the save step re-validates every row —
// the client is never trusted, even though the rows came from our own extraction.
// Write contract for saved rows: see lib/knowledge/sync.ts

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth";
import {
  checkKnowledgeImportLimit,
  checkKnowledgeWriteLimit,
} from "@/lib/redis";
import { extractCatalogRows } from "@/lib/ai/extract";
import { syncEntries } from "@/lib/knowledge/sync";
import {
  getOrgKnowledgeEntryCount,
  getOrgPlan,
  lockOrgForKnowledgeWrite,
} from "@/lib/db/queries/knowledge";
import {
  getNextEntrySortOrder,
  getSectionEntryTitles,
  getSectionKind,
  insertImportedEntries,
} from "@/lib/db/queries/knowledge-import";
import { dropDuplicates, flagRows } from "@/helpers/knowledge-import";
import { toSyncStatus } from "@/helpers/knowledge";
import {
  extractTextSchema,
  importRowsSchema,
} from "@/helpers/knowledge-schemas";
import { PLAN_LIMITS } from "@/types/billing";
import type { ActionResult } from "@/types/api";
import type { ExtractResult, ImportSaveData } from "@/types/knowledge";

const KNOWLEDGE_PATH = "/dashboard/knowledge";

// Marks an error message as safe to show the owner. Anything NOT thrown as this class
// becomes a generic message, so internal DB/OpenAI text never reaches the browser.
class ImportUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportUserError";
  }
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Input tidak valid";
}

// Shared wrapper: admin only → errors handled in one place.
// requireOrgAdmin() stays OUTSIDE the try so an unauthorized call throws like every other mutation
// (and doesn't flood Sentry). Not shared with knowledge.ts's runWrite on purpose — that one is a
// private helper of another "use server" file.
async function runAdmin<T>(
  name: string,
  fn: (orgId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const { orgId } = await requireOrgAdmin();

  try {
    return await fn(orgId);
  } catch (err) {
    if (err instanceof ImportUserError) {
      return { success: false, error: err.message };
    }

    // Only ids go to logs and Sentry — never the pasted text or the rows
    console.error(`[knowledge-import/${name}] failed:`, err);
    Sentry.captureException(err, { extra: { orgId, action: name } });
    return { success: false, error: "Terjadi kesalahan. Coba lagi." };
  }
}

// ─── Step 1: extraction (saves nothing) ───

export async function extractCatalogFromText(
  rawInput: unknown,
): Promise<ActionResult<ExtractResult>> {
  return runAdmin("extractCatalogFromText", async (orgId) => {
    const parsed = extractTextSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { sectionId, text } = parsed.data;

    // Cheap checks first — a request that can't succeed must not cost OpenAI credits
    // or use up the rate limit. Same "not found" whether the section is missing or foreign.
    const kind = await getSectionKind(orgId, sectionId);
    if (kind === null) {
      return { success: false, error: "Bagian tidak ditemukan" };
    }
    if (kind !== "catalog") {
      return { success: false, error: "Impor hanya bisa ke bagian katalog." };
    }

    // Advisory only: the real, atomic check runs inside the save transaction
    const plan = await getOrgPlan(orgId);
    const used = await getOrgKnowledgeEntryCount(orgId);
    const remainingSlots = Math.max(
      0,
      PLAN_LIMITS[plan].knowledgeEntries - used,
    );
    if (remainingSlots === 0) {
      return {
        success: false,
        error:
          "Batas entri tercapai. Upgrade plan untuk menambah lebih banyak.",
      };
    }

    // The rate limit sits right before the paid call, so only real extractions count
    const limit = await checkKnowledgeImportLimit(orgId);
    if (!limit.success) {
      return {
        success: false,
        error: "Terlalu banyak impor. Coba lagi dalam beberapa saat.",
      };
    }

    let extracted;
    try {
      extracted = await extractCatalogRows(text);
    } catch (err) {
      // The error carries a status code at most — never the text or OpenAI's response body
      console.error("[knowledge-import/extract] extraction failed:", err);
      Sentry.captureException(err, {
        extra: { orgId, action: "extractCatalogFromText" },
      });
      return { success: false, error: "Gagal membaca teks. Coba lagi." };
    }

    // Warnings are advisory — the owner decides in the review screen
    const existingTitles = await getSectionEntryTitles(orgId, sectionId);
    return {
      success: true,
      data: { rows: flagRows(extracted, existingTitles), remainingSlots },
    };
  });
}

// ─── Step 2: save the reviewed rows ───

export async function importCatalogRows(
  rawInput: unknown,
): Promise<ActionResult<ImportSaveData>> {
  return runAdmin("importCatalogRows", async (orgId) => {
    // Same hourly bucket as every other knowledge save
    const limit = await checkKnowledgeWriteLimit(orgId);
    if (!limit.success) {
      return {
        success: false,
        error: "Terlalu banyak perubahan. Coba lagi dalam beberapa saat.",
      };
    }

    // Re-validate EVERYTHING — types, lengths, row count, price shapes
    const parsed = importRowsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { sectionId, rows } = parsed.data;

    const outcome = await db.transaction(async (tx) => {
      // Lock first — two concurrent saves (a double click) queue here, so the duplicate check
      // and the slot count below can never both pass on stale data
      const plan = await lockOrgForKnowledgeWrite(tx, orgId);
      if (!plan) throw new ImportUserError("Organisasi tidak ditemukan");

      const kind = await getSectionKind(orgId, sectionId, tx);
      if (kind === null) throw new ImportUserError("Bagian tidak ditemukan");
      if (kind !== "catalog") {
        throw new ImportUserError("Impor hanya bisa ke bagian katalog.");
      }

      // Names that already exist (or repeat inside this batch) are skipped, not inserted twice
      const existingTitles = await getSectionEntryTitles(orgId, sectionId, tx);
      const { fresh, skipped } = dropDuplicates(rows, existingTitles);

      const used = await getOrgKnowledgeEntryCount(orgId, tx);
      const free = Math.max(0, PLAN_LIMITS[plan].knowledgeEntries - used);

      // Everything is skipped — nothing to insert
      if (fresh.length === 0) return { ids: [], skipped, remainingSlots: free };

      // All-or-nothing for the batch: reject with the real number of free slots
      if (fresh.length > free) {
        throw new ImportUserError(
          `Slot entri tidak cukup — tersisa ${free}, sedangkan ${fresh.length} item akan disimpan.`,
        );
      }

      const firstSortOrder = await getNextEntrySortOrder(orgId, sectionId, tx);
      const ids = await insertImportedEntries(
        tx,
        orgId,
        sectionId,
        fresh,
        firstSortOrder,
      );

      return { ids, skipped, remainingSlots: free - ids.length };
    });

    // Nothing was inserted, so there is nothing to sync
    if (outcome.ids.length === 0) {
      return {
        success: true,
        data: {
          saved: 0,
          skippedDuplicates: outcome.skipped,
          syncStatus: "synced",
          remainingSlots: outcome.remainingSlots,
        },
      };
    }

    // Embedding happens OUTSIDE the transaction. Only this batch + the section summary are rebuilt.
    // If it fails, the rows stay saved as "stale" and the existing retry banner picks them up.
    const result = await syncEntries(orgId, sectionId, outcome.ids);

    revalidatePath(KNOWLEDGE_PATH);
    return {
      success: true,
      data: {
        saved: outcome.ids.length,
        skippedDuplicates: outcome.skipped,
        syncStatus: toSyncStatus(result),
        remainingSlots: outcome.remainingSlots,
      },
    };
  });
}
