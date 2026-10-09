// The two loops behind the import dialog: read the pasted text batch by batch, and save the
// reviewed rows batch by batch. Pure async functions — the Server Actions are INJECTED, so these
// never import "use server" code and are tested with plain fakes.
// Both loops stop at the first failure and report what was done, so nothing is lost or repeated.

import {
  appendDrafts,
  buildSaveBatches,
} from "@/helpers/knowledge-import-draft";
import { splitIntoBatches } from "@/helpers/knowledge-import";
import { MAX_IMPORT_TOTAL_ROWS } from "@/types/knowledge";
import type {
  DraftRow,
  ExtractFn,
  ExtractionOutcome,
  SaveFn,
  SaveOutcome,
} from "@/types/knowledge-import";

interface ExtractionOptions {
  sectionId: number;
  text: string;
  extract: ExtractFn;
  existingKeys: ReadonlySet<string>; // normalized names already in the section
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

// Reads the text one batch at a time. A failure on batch 4 keeps the rows from batches 1–3.
export async function runExtraction(
  opts: ExtractionOptions,
): Promise<ExtractionOutcome> {
  const batches = splitIntoBatches(opts.text);
  let drafts: DraftRow[] = [];
  let remainingSlots: number | null = null;
  let error: string | null = null;
  let truncated = false;
  let done = 0;

  opts.onProgress?.(0, batches.length);

  for (const batch of batches) {
    if (opts.signal?.aborted) break;

    let result: Awaited<ReturnType<ExtractFn>>;
    try {
      result = await opts.extract({ sectionId: opts.sectionId, text: batch });
    } catch {
      // A thrown action (network, session) — never show its raw message
      error = "Gagal membaca teks. Periksa koneksi lalu coba lagi.";
      break;
    }

    if (!result.success) {
      error = result.error;
      break;
    }

    remainingSlots = result.data.remainingSlots;

    // Total row cap — rows beyond it are dropped and the owner is told
    const room = MAX_IMPORT_TOTAL_ROWS - drafts.length;
    if (result.data.rows.length > room) truncated = true;
    drafts = appendDrafts(
      drafts,
      result.data.rows.slice(0, room),
      opts.existingKeys,
    );

    done += 1;
    opts.onProgress?.(done, batches.length);

    // Cap reached — the remaining batches are not read
    if (drafts.length >= MAX_IMPORT_TOTAL_ROWS) {
      if (done < batches.length) truncated = true;
      break;
    }
  }

  return {
    drafts,
    remainingSlots,
    error,
    truncated,
    batchesDone: done,
    batchesTotal: batches.length,
  };
}

interface SaveOptions {
  sectionId: number;
  rows: DraftRow[];
  save: SaveFn;
  onProgress?: (done: number, total: number) => void; // counted in ROWS
  signal?: AbortSignal;
}

// Saves the selected rows, one call per batch, one after another.
// Rows from successful batches are returned in processedIds so the dialog can remove them —
// a retry after a failure then only sends what is left.
export async function runSave(opts: SaveOptions): Promise<SaveOutcome> {
  const batches = buildSaveBatches(opts.rows);
  const total = batches.reduce((sum, batch) => sum + batch.rows.length, 0);

  const outcome: SaveOutcome = {
    processedIds: [],
    saved: 0,
    skippedDuplicates: 0,
    anyStale: false,
    remainingSlots: null,
    error: null,
  };
  let done = 0;

  opts.onProgress?.(0, total);

  for (const batch of batches) {
    if (opts.signal?.aborted) break;

    let result: Awaited<ReturnType<SaveFn>>;
    try {
      result = await opts.save({ sectionId: opts.sectionId, rows: batch.rows });
    } catch {
      outcome.error = "Gagal menyimpan. Periksa koneksi lalu coba lagi.";
      break;
    }

    if (!result.success) {
      outcome.error = result.error;
      break;
    }

    outcome.processedIds.push(...batch.editorIds);
    outcome.saved += result.data.saved;
    outcome.skippedDuplicates += result.data.skippedDuplicates;
    outcome.anyStale = outcome.anyStale || result.data.syncStatus === "stale";
    outcome.remainingSlots = result.data.remainingSlots;

    done += batch.rows.length;
    opts.onProgress?.(done, total);
  }

  return outcome;
}
