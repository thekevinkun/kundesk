// The loop behind the "Foto" tab: shrink the photo, send it, turn the rows into review drafts.
// Pure async function — the compressor and the upload are INJECTED, so it is tested with plain
// fakes and never imports browser or network code. Returns the same outcome shape as the text
// runner, so the dialog's hook and the review screen treat both sources alike.
// A photo is ONE read (one call), unlike pasted text which is split into batches.

import { appendDrafts } from "@/helpers/knowledge-import-draft";
import type {
  CompressFn,
  ExtractionOutcome,
  PhotoStage,
  PhotoUploadFn,
} from "@/types/knowledge-import";

interface PhotoExtractionOptions {
  sectionId: number;
  file: File;
  compress: CompressFn;
  upload: PhotoUploadFn;
  existingKeys: ReadonlySet<string>; // normalized names already in the section
  onStage?: (stage: PhotoStage) => void;
  signal?: AbortSignal;
}

// A read that produced nothing: an error to show, or null when the owner simply cancelled
function nothing(error: string | null): ExtractionOutcome {
  return {
    drafts: [],
    remainingSlots: null,
    error,
    truncated: false,
    batchesDone: 0,
    batchesTotal: 1,
  };
}

export async function runPhotoExtraction(
  opts: PhotoExtractionOptions,
): Promise<ExtractionOutcome> {
  if (opts.signal?.aborted) return nothing(null);

  // ── Stage 1: shrink to an uploadable JPEG ──
  opts.onStage?.("compressing");
  let compressed: Awaited<ReturnType<CompressFn>>;
  try {
    compressed = await opts.compress(opts.file);
  } catch {
    return nothing("Gagal memproses foto. Coba lagi.");
  }
  if (!compressed.ok) return nothing(compressed.error);

  // Cancelled while compressing — nothing was sent, nothing is spent
  if (opts.signal?.aborted) return nothing(null);

  // ── Stage 2: send it and read the answer ──
  opts.onStage?.("reading");
  let result: Awaited<ReturnType<PhotoUploadFn>>;
  try {
    result = await opts.upload({
      sectionId: opts.sectionId,
      photo: compressed.blob,
      signal: opts.signal,
    });
  } catch {
    // The owner cancelled: not an error. Anything else is a network failure — never show its raw message
    if (opts.signal?.aborted) return nothing(null);
    return nothing("Gagal membaca foto. Periksa koneksi lalu coba lagi.");
  }

  if (!result.success) return nothing(result.error);

  return {
    // Same warnings and default selection as pasted rows: duplicates and instruction-like rows start unselected
    drafts: appendDrafts([], result.data.rows, opts.existingKeys),
    remainingSlots: result.data.remainingSlots,
    error: null,
    truncated: result.data.truncated,
    batchesDone: 1,
    batchesTotal: 1,
  };
}
