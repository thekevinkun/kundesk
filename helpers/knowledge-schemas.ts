// Zod schemas for structured knowledge input
// Shared by the Server Actions now and the dashboard forms later
// No "use server" here — a "use server" file can only export async functions

import { z } from "zod/v4";
import { countNonEmptyLines } from "@/helpers/knowledge-import";
import {
  MAX_IMPORT_BATCH_CHARS,
  MAX_IMPORT_DESCRIPTION_CHARS,
  MAX_IMPORT_EXTRACT_LINES,
  MAX_IMPORT_SAVE_ROWS,
  MAX_KNOWLEDGE_SECTIONS,
} from "@/types/knowledge";
import type { HoursSchedule } from "@/types/knowledge";

// Whole rupiah, no decimals — same unit as the rest of the billing code
const rupiah = z
  .number()
  .int("Harga harus bilangan bulat")
  .min(0, "Harga tidak boleh negatif")
  .max(1_000_000_000, "Harga terlalu besar");

// Empty text becomes null — the DB stores "no value", never ""
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .nullish()
    .transform((value) => (value ? value : null));

// Required short text with consistent Indonesian messages
const shortText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi`)
    .max(max, `${label} maksimal ${max} karakter`);

const idSchema = z.number().int().positive();

// ─── Price ───
export const entryPriceSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("fixed"), amount: rupiah }),
    z.object({ mode: z.literal("range"), min: rupiah, max: rupiah }),
    z.object({
      mode: z.literal("variants"),
      options: z
        .array(
          z.object({ label: shortText(60, "Nama pilihan"), amount: rupiah }),
        )
        .min(1, "Isi minimal satu pilihan harga")
        .max(20, "Maksimal 20 pilihan harga"),
    }),
    z.object({ mode: z.literal("contact") }),
  ])
  // Checked on the whole union — a range whose max is below its min makes no sense
  .refine((price) => price.mode !== "range" || price.max >= price.min, {
    message: "Harga maksimum harus sama atau lebih besar dari harga minimum",
  });

// ─── Sections ───
const sectionKindSchema = z.enum(["catalog", "faq", "policy", "promo", "note"]);

export const createSectionSchema = z.object({
  kind: sectionKindSchema,
  title: shortText(80, "Nama bagian"),
  note: optionalText(300, "Catatan maksimal 300 karakter"),
});

export const updateSectionSchema = createSectionSchema.extend({ id: idSchema });

// ─── Entries ───
const entryFields = {
  title: shortText(120, "Judul"),
  body: z.string().trim().max(2000, "Isi maksimal 2000 karakter").default(""),
  price: entryPriceSchema.nullable().default(null),
  isAvailable: z.boolean().default(true),
};

export const createEntrySchema = z.object({
  sectionId: idSchema,
  ...entryFields,
});

export const updateEntrySchema = z.object({ id: idSchema, ...entryFields });

export const setEntryAvailabilitySchema = z.object({
  id: idSchema,
  isAvailable: z.boolean(),
});

// Used by delete actions
export const idOnlySchema = z.object({ id: idSchema });

// ─── Business profile ───

// 24-hour clock "HH:MM" — an opening time can't be 24:00, a closing time can (end of day)
const opensSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Jam buka harus berformat HH:MM, contoh 08:00",
  );
const closesSchema = z
  .string()
  .regex(
    /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/,
    "Jam tutup harus berformat HH:MM, contoh 20:00",
  );

const hoursLineSchema = z
  .object({
    // JS weekday numbers: 0 = Minggu … 6 = Sabtu
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Pilih minimal satu hari")
      .refine(
        (days) => new Set(days).size === days.length,
        "Hari tidak boleh ganda",
      ),
    opens: opensSchema,
    closes: closesSchema,
    note: z
      .string()
      .trim()
      .max(100, "Catatan maksimal 100 karakter")
      .optional(),
  })
  .refine((line) => line.opens !== line.closes, {
    message: "Jam buka dan jam tutup tidak boleh sama",
  });

const hoursScheduleSchema = z.object({
  label: shortText(40, "Nama jadwal"),
  lines: z
    .array(hoursLineSchema)
    .min(1, "Isi minimal satu baris jam")
    .max(14, "Maksimal 14 baris per jadwal"),
  note: z.string().trim().max(150, "Catatan maksimal 150 karakter").optional(),
});

const contactSchema = z.object({
  label: shortText(40, "Nama kontak"),
  value: shortText(100, "Isi kontak"),
});

const paymentMethodSchema = z.object({
  label: shortText(40, "Metode pembayaran"),
  detail: z.string().trim().max(120, "Detail maksimal 120 karakter").optional(),
});

export const saveProfileSchema = z.object({
  about: optionalText(1000, "Deskripsi maksimal 1000 karakter"),
  address: optionalText(300, "Alamat maksimal 300 karakter"),
  contacts: z.array(contactSchema).max(10, "Maksimal 10 kontak").default([]),
  hours: z.array(hoursScheduleSchema).max(8, "Maksimal 8 jadwal").default([]),
  paymentMethods: z
    .array(paymentMethodSchema)
    .max(12, "Maksimal 12 metode pembayaran")
    .default([]),
});

// Input to retryStaleKnowledgeSync — the client's own accumulated list of
// sections that already failed in this retry session, so the server can
// skip them and surface untried sections instead
export const retrySyncSchema = z.object({
  excludeSectionIds: z.array(idSchema).max(MAX_KNOWLEDGE_SECTIONS).default([]),
});

// Keeps only the schedules in stored data that pass the same rules as the save form.
// Stored JSON can predate a format change or be edited by hand in Neon. A bad schedule is dropped
// WHOLE (a half-read schedule could tell customers the wrong hours) and counted so callers can log it.
export function parseStoredHours(value: unknown): {
  hours: HoursSchedule[];
  dropped: number;
} {
  if (!Array.isArray(value)) {
    return {
      hours: [],
      dropped: value === null || value === undefined ? 0 : 1,
    };
  }

  const hours: HoursSchedule[] = [];
  for (const item of value) {
    const parsed = hoursScheduleSchema.safeParse(item);
    if (parsed.success) hours.push(parsed.data);
  }

  return { hours, dropped: value.length - hours.length };
}

// ─── Catalog import ───

// Collapses newlines, tabs and other control characters into single spaces.
// A newline inside a title would let imported text add fake lines to the section summary chunk.
export function toSingleLine(value: string): string {
  // Control characters (code < 32 and DEL 127) become spaces — checked by code, not by regex,
  // because ESLint's no-control-regex rule forbids control characters inside a pattern
  let cleaned = "";
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    cleaned += code < 32 || code === 127 ? " " : value[i];
  }

  // \s already covers tabs, line/paragraph separators (U+2028, U+2029) and non-breaking spaces,
  // so this collapses every run of whitespace into one space
  return cleaned.replace(/\s+/g, " ").trim();
}

// Import prices: no "variants" in v1 — those stay manual
const importPriceSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("fixed"), amount: rupiah }),
    z.object({ mode: z.literal("range"), min: rupiah, max: rupiah }),
    z.object({ mode: z.literal("contact") }),
  ])
  .refine((price) => price.mode !== "range" || price.max >= price.min, {
    message: "Harga maksimum harus sama atau lebih besar dari harga minimum",
  });

// One row as the SERVER accepts it on save — the client is never trusted, even if the
// row came from our own extraction step
export const importRowSchema = z.object({
  title: z
    .string()
    .transform(toSingleLine)
    .pipe(
      z
        .string()
        .min(1, "Nama item wajib diisi")
        .max(120, "Nama item maksimal 120 karakter"),
    ),
  // Optional — empty becomes "", stored in the entry's body
  description: z
    .string()
    .nullish()
    .transform((value) => (value ? toSingleLine(value) : ""))
    .pipe(
      z
        .string()
        .max(
          MAX_IMPORT_DESCRIPTION_CHARS,
          `Deskripsi maksimal ${MAX_IMPORT_DESCRIPTION_CHARS} karakter`,
        ),
    ),
  // Required at save time — a row with an unreadable price must be fixed or set to "contact" in review
  price: importPriceSchema,
});

// The whole save call: target section + one batch of rows
export const importRowsSchema = z.object({
  sectionId: idSchema,
  rows: z
    .array(importRowSchema)
    .min(1, "Tidak ada item untuk disimpan")
    .max(
      MAX_IMPORT_SAVE_ROWS,
      `Maksimal ${MAX_IMPORT_SAVE_ROWS} item per simpan`,
    ),
});

// Input to the extraction step: the target catalog section + ONE batch of pasted text.
// The client splits long text with splitIntoBatches, but the server enforces the bounds itself.
export const extractTextSchema = z.object({
  sectionId: idSchema,
  text: z
    .string()
    .max(
      MAX_IMPORT_BATCH_CHARS,
      `Teks terlalu panjang (maksimal ${MAX_IMPORT_BATCH_CHARS} karakter per proses)`,
    )
    .refine(
      (text) => countNonEmptyLines(text) >= 1,
      "Tempel teks yang ingin diimpor",
    )
    .refine(
      (text) => countNonEmptyLines(text) <= MAX_IMPORT_EXTRACT_LINES,
      `Maksimal ${MAX_IMPORT_EXTRACT_LINES} baris per proses`,
    ),
});
