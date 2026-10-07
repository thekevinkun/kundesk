// Types for structured business knowledge (form-based alternative to document upload)
// Stored as JSONB in the DB — validated with Zod at every write boundary

// Kinds of knowledge section — drives the form UI and how chunks are worded
export type SectionKind = "catalog" | "faq" | "policy" | "promo" | "note";

// "stale" = row saved but its chunks weren't re-embedded yet (e.g. OpenAI was down)
export type SyncStatus = "synced" | "stale";

// Price of one catalog entry — three real shapes seen in Bu Sari and Rumah Paco docs
export type EntryPrice =
  | { mode: "fixed"; amount: number } // Rp 25.000
  | { mode: "range"; min: number; max: number } // Rp 45.000 – 65.000
  | { mode: "variants"; options: { label: string; amount: number }[] } // by weight/size
  | { mode: "contact" }; // "hubungi kami" / depends on stock

// One line of a schedule, e.g. { days: "Senin – Jumat", time: "08.00 – 20.00" }
export interface HoursLine {
  // Weekday numbers, JS convention: 0 = Minggu … 6 = Sabtu
  days: number[];
  // 24-hour "HH:MM". `closes` may be "24:00". If closes < opens, the shift ends after midnight
  opens: string;
  closes: string;
  note?: string | undefined;
}

// A named schedule — Rumah Paco has three (Klinik, Pet Shop, Darurat)
export interface HoursSchedule {
  label: string;
  lines: HoursLine[];
  note?: string | undefined;
}

// Labeled contact — Rumah Paco has two different WhatsApp numbers with different purposes
export interface ContactItem {
  label: string; // "WhatsApp Darurat"
  value: string; // "0821-4567-8902"
}

// Payment method with optional detail such as an account number
export interface PaymentMethod {
  label: string;
  detail?: string | undefined;
}

// ─── Compile helper inputs ───
// Minimal shapes the compile helpers need — decoupled from Drizzle row types
// so tests never need a database. Drizzle rows are structurally assignable to these.

export interface CompileSection {
  kind: SectionKind;
  title: string;
  note: string | null;
}

export interface CompileEntry {
  title: string;
  body: string;
  price: EntryPrice | null;
  isAvailable: boolean;
}

export interface CompileProfile {
  about: string | null;
  address: string | null;
  contacts: ContactItem[];
  hours: HoursSchedule[];
  paymentMethods: PaymentMethod[];
}

// ─── Sync layer ───

// One chunk ready to embed + store — exactly ONE of entryId / sectionId is set
export interface SyncItem {
  content: string;
  entryId: number | null; // per-item chunk
  sectionId: number | null; // section summary chunk
}

// Outcome of a sync — DB errors are thrown, not returned
export type SyncResult =
  | { status: "synced"; chunkCount: number }
  // A newer save changed the data mid-sync — that save's own sync owns the result
  | { status: "superseded" }
  // OpenAI failed — old chunks kept, entries stay "stale" so a retry can fix them
  | { status: "embed_failed" }
  | { status: "not_found" };

// ─── Limits ───

// Max sections per org — bounds sync work and dashboard clutter
export const MAX_KNOWLEDGE_SECTIONS = 30;

// Max characters of the compiled profile block — it rides along on EVERY chat message
export const MAX_PROFILE_BLOCK_CHARS = 2500;

// ─── Catalog import limits ───

// Rows saved per Server Action call — keeps each call (insert + embed) well under Vercel's 10s cap
// Tunable: confirm with a live test before raising
export const MAX_IMPORT_SAVE_ROWS = 25;

// Max lines of pasted text per extraction call — same reason
export const MAX_IMPORT_EXTRACT_LINES = 30;

// Max rows one import can produce in total (Rumah Paco has ~190 items)
export const MAX_IMPORT_TOTAL_ROWS = 200;

// Max characters of pasted text per import — bounds OpenAI cost before any call is made
export const MAX_IMPORT_INPUT_CHARS = 20_000;

// Max characters of an imported description — far below the manual 2000 limit on purpose
export const MAX_IMPORT_DESCRIPTION_CHARS = 300;

// Max characters of pasted text in ONE extraction call (a batch of ~30 lines)
export const MAX_IMPORT_BATCH_CHARS = 10_000;

// ─── Catalog import shapes ───

// Price shapes import can produce — "variants" stays manual in v1
export type ImportPrice = Exclude<EntryPrice, { mode: "variants" }>;

// One row coming out of extraction, before the owner reviews it.
// price null = no readable price — the review screen must make the owner fix it or pick "hubungi kami"
export interface ExtractedRow {
  title: string;
  description: string;
  price: ImportPrice | null;
}

// A row as the save action accepts it: the owner has reviewed it and every field is final
export interface ImportRow {
  title: string;
  description: string;
  price: ImportPrice; // required — a row with no readable price must be fixed in review first
}

// Warnings shown on a review row — advisory, the owner decides
export interface RowFlags {
  injection: boolean; // text looks like an instruction to the AI
  suspiciousPrice: boolean; // very small or very large amount — often a missing "k" / "rb"
  duplicate: boolean; // name already exists in the target section, or earlier in this batch
}

// An extracted row plus its warnings, as the review screen receives it
export interface ReviewRow extends ExtractedRow {
  flags: RowFlags;
}

// Returned by the extraction step
export interface ExtractResult {
  rows: ReviewRow[];
  remainingSlots: number; // free entry slots left on the plan
}

// Returned by the save step
export interface ImportSaveData {
  saved: number;
  skippedDuplicates: number;
  syncStatus: SyncStatus;
  remainingSlots: number;
}

// ─── Server Action result data ───

// Returned after creating/updating one entry
export interface EntrySaveData {
  id: number;
  syncStatus: SyncStatus; // "stale" = saved, but KUN hasn't picked it up yet — UI should offer a retry
}

// Returned after actions that only rebuild chunks
export interface SyncStatusData {
  syncStatus: SyncStatus;
}

// Returned by the retry action — remaining > 0 means "call again"
export interface RetrySyncData {
  synced: number;
  remaining: number;
  // Sections attempted this call that are still stale — pass back as
  // excludeSectionIds on the next call so a persistently-failing section
  // can't crowd out other stale sections from ever being attempted
  // (CodeRabbit finding — the previous version had no rotation at all)
  failedSectionIds: number[];
  // How many sections this call actually tried. 0 means nothing left to
  // try this round — either everything's synced, or every remaining
  // stale section is already in excludeSectionIds. This is the signal
  // the client uses to stop looping, instead of guessing from synced=0.
  attemptedCount: number;
}

// What the chat route needs from a profile: the static text plus the raw hours
// (raw hours are needed because open/closed is computed on every request, never cached)
export interface ProfileData {
  block: string | null;
  hours: HoursSchedule[];
}

// ─── Dashboard read shapes ───

// One entry as read for the dashboard list/edit UI
export interface KnowledgeEntryRow {
  id: number;
  title: string;
  body: string;
  price: EntryPrice | null;
  isAvailable: boolean;
  sortOrder: number;
  syncStatus: SyncStatus;
}

// One section with its entries, for the Katalog & FAQ tab
export interface KnowledgeSectionRow {
  id: number;
  kind: SectionKind;
  title: string;
  note: string | null;
  sortOrder: number;
  entries: KnowledgeEntryRow[];
}
