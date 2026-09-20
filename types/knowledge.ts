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
  days: string;
  time: string;
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
}
