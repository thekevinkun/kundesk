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
  note?: string;
}

// A named schedule — Rumah Paco has three (Klinik, Pet Shop, Darurat)
export interface HoursSchedule {
  label: string;
  lines: HoursLine[];
  note?: string;
}

// Labeled contact — Rumah Paco has two different WhatsApp numbers with different purposes
export interface ContactItem {
  label: string; // "WhatsApp Darurat"
  value: string; // "0821-4567-8902"
}

// Payment method with optional detail such as an account number
export interface PaymentMethod {
  label: string; // "Transfer BCA"
  detail?: string; // "9876543210 a.n. Rumah Paco"
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
