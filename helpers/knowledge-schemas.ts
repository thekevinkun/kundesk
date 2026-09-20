// Zod schemas for structured knowledge input
// Shared by the Server Actions now and the dashboard forms later
// No "use server" here — a "use server" file can only export async functions

import { z } from "zod/v4";

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
const hoursLineSchema = z.object({
  days: shortText(40, "Hari"),
  time: shortText(40, "Jam"),
  note: z.string().trim().max(100, "Catatan maksimal 100 karakter").optional(),
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
