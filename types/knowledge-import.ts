// Types for the catalog import review screen and its pure logic
// (helpers/knowledge-import-draft.ts, helpers/knowledge-import-runner.ts).
// UI-only — nothing here is stored.

import type { ActionResult } from "@/types/api";
import type {
  ExtractResult,
  ImportPrice,
  ImportRow,
  ImportSaveData,
  PhotoExtractResult,
  RowFlags,
} from "@/types/knowledge";
import type { CompressResult } from "@/types/image-compress";

// One row in the review screen — editable by the owner until they confirm
export interface DraftRow {
  editorId: string; // client-only key for React lists — never sent to the server
  title: string;
  description: string;
  price: ImportPrice | null; // null = no readable price: fix it, or leave the row unselected
  selected: boolean;
  flags: RowFlags;
}

// The Server Actions as the runners see them. Injected, so the runners never import "use server" code
export type ExtractFn = (input: {
  sectionId: number;
  text: string;
}) => Promise<ActionResult<ExtractResult>>;

export type SaveFn = (input: {
  sectionId: number;
  rows: ImportRow[];
}) => Promise<ActionResult<ImportSaveData>>;

// Photo import: shrinks the owner's photo into an uploadable JPEG (compressPhotoForImport in production)
export type CompressFn = (file: File) => Promise<CompressResult>;

// Photo import: sends the JPEG to the photo route and returns its answer in the same shape as the text action
export type PhotoUploadFn = (input: {
  sectionId: number;
  photo: Blob;
  signal?: AbortSignal | undefined;
}) => Promise<ActionResult<PhotoExtractResult>>;

// Which part of a photo read is running — the dialog shows a different label for each
export type PhotoStage = "compressing" | "reading";

// One save call: the rows plus the editorIds they came from (same order)
export interface SaveBatch {
  editorIds: string[];
  rows: ImportRow[];
}

// Whether the Confirm button may be pressed, and why not
export interface ConfirmState {
  selectedCount: number;
  blockingRows: number; // selected rows that still have an error
  overSlots: boolean; // more rows selected than free plan slots
  canConfirm: boolean;
  reason: string | null; // shown next to the button when canConfirm is false
}

// Result of reading the pasted text (possibly partial when an error stopped it)
export interface ExtractionOutcome {
  drafts: DraftRow[];
  remainingSlots: number | null; // null = no batch succeeded, so unknown
  error: string | null;
  truncated: boolean; // the 200-row cap cut the result short
  batchesDone: number;
  batchesTotal: number;
}

// Result of the save loop (possibly partial when an error stopped it)
export interface SaveOutcome {
  processedIds: string[]; // rows saved OR skipped as duplicates — safe to remove from the review list
  saved: number;
  skippedDuplicates: number;
  anyStale: boolean; // at least one batch saved but could not be embedded yet
  remainingSlots: number | null;
  error: string | null;
}

// An owner edit to one row — exactly what updateRow accepts
export type DraftPatch = Partial<
  Pick<DraftRow, "title" | "description" | "price" | "selected">
>;

// Where the rows come from: pasted text, or a photo of a menu
export type ImportSource = "text" | "photo";

// Which screen of the import dialog is showing
export type ImportStep = "paste" | "reading" | "review" | "saving" | "result";

// Progress of the reading or saving loop
export interface ImportProgressState {
  done: number;
  total: number;
}

// Running totals across save attempts — a failed save can be retried, so one import may take several
export interface ImportTotals {
  saved: number;
  skippedDuplicates: number;
  anyStale: boolean;
}
