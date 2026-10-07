// Unit tests for helpers/knowledge-schemas.ts
// Pure Zod parsing — no mocks needed

import { describe, it, expect } from "vitest";
import {
  createEntrySchema,
  createSectionSchema,
  entryPriceSchema,
  extractTextSchema,
  importRowSchema,
  importRowsSchema,
  saveProfileSchema,
  setEntryAvailabilitySchema,
  parseStoredHours,
  toSingleLine,
} from "./knowledge-schemas";
import {
  MAX_IMPORT_BATCH_CHARS,
  MAX_IMPORT_DESCRIPTION_CHARS,
  MAX_IMPORT_EXTRACT_LINES,
  MAX_IMPORT_SAVE_ROWS,
} from "@/types/knowledge";

describe("entryPriceSchema", () => {
  it("accepts all four price modes", () => {
    expect(
      entryPriceSchema.safeParse({ mode: "fixed", amount: 25000 }).success,
    ).toBe(true);
    expect(
      entryPriceSchema.safeParse({ mode: "range", min: 45000, max: 65000 })
        .success,
    ).toBe(true);
    expect(entryPriceSchema.safeParse({ mode: "contact" }).success).toBe(true);
    expect(
      entryPriceSchema.safeParse({
        mode: "variants",
        options: [{ label: "Di bawah 3 kg", amount: 500000 }],
      }).success,
    ).toBe(true);
  });

  it("rejects a range whose max is below its min", () => {
    expect(
      entryPriceSchema.safeParse({ mode: "range", min: 65000, max: 45000 })
        .success,
    ).toBe(false);
  });

  it("accepts a range where min equals max", () => {
    expect(
      entryPriceSchema.safeParse({ mode: "range", min: 5000, max: 5000 })
        .success,
    ).toBe(true);
  });

  it("rejects negative, fractional, and absurdly large amounts", () => {
    expect(
      entryPriceSchema.safeParse({ mode: "fixed", amount: -1 }).success,
    ).toBe(false);
    expect(
      entryPriceSchema.safeParse({ mode: "fixed", amount: 1500.5 }).success,
    ).toBe(false);
    expect(
      entryPriceSchema.safeParse({ mode: "fixed", amount: 2_000_000_000 })
        .success,
    ).toBe(false);
  });

  it("rejects variants with no options and unknown modes", () => {
    expect(
      entryPriceSchema.safeParse({ mode: "variants", options: [] }).success,
    ).toBe(false);
    expect(entryPriceSchema.safeParse({ mode: "free" }).success).toBe(false);
  });
});

describe("createSectionSchema", () => {
  it("trims the title and turns an empty note into null", () => {
    const parsed = createSectionSchema.parse({
      kind: "catalog",
      title: "  Menu Sarapan  ",
      note: "   ",
    });

    expect(parsed.title).toBe("Menu Sarapan");
    expect(parsed.note).toBeNull();
  });

  it("treats a missing note as null", () => {
    expect(
      createSectionSchema.parse({ kind: "faq", title: "FAQ" }).note,
    ).toBeNull();
  });

  it("rejects an empty title, an unknown kind, and a too-long title", () => {
    expect(
      createSectionSchema.safeParse({ kind: "catalog", title: "   " }).success,
    ).toBe(false);
    expect(
      createSectionSchema.safeParse({ kind: "blog", title: "X" }).success,
    ).toBe(false);
    expect(
      createSectionSchema.safeParse({ kind: "catalog", title: "a".repeat(81) })
        .success,
    ).toBe(false);
  });
});

describe("createEntrySchema", () => {
  it("fills defaults: empty body, no price, available", () => {
    const parsed = createEntrySchema.parse({
      sectionId: 1,
      title: "Nasi Kuning",
    });

    expect(parsed.body).toBe("");
    expect(parsed.price).toBeNull();
    expect(parsed.isAvailable).toBe(true);
  });

  it("rejects a body over 2000 characters and a non-positive sectionId", () => {
    expect(
      createEntrySchema.safeParse({
        sectionId: 1,
        title: "X",
        body: "a".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      createEntrySchema.safeParse({ sectionId: 0, title: "X" }).success,
    ).toBe(false);
  });
});

describe("setEntryAvailabilitySchema", () => {
  it("requires an explicit boolean", () => {
    expect(
      setEntryAvailabilitySchema.safeParse({ id: 1, isAvailable: false })
        .success,
    ).toBe(true);
    expect(setEntryAvailabilitySchema.safeParse({ id: 1 }).success).toBe(false);
  });
});

describe("saveProfileSchema", () => {
  it("accepts an empty profile and defaults the lists", () => {
    const parsed = saveProfileSchema.parse({});

    expect(parsed.about).toBeNull();
    expect(parsed.address).toBeNull();
    expect(parsed.contacts).toEqual([]);
    expect(parsed.hours).toEqual([]);
    expect(parsed.paymentMethods).toEqual([]);
  });

  it("accepts a Rumah Paco-style profile", () => {
    const result = saveProfileSchema.safeParse({
      about: "Klinik hewan dan pet shop lengkap.",
      address: "Jalan Kesehatan No. 12, Samarinda",
      contacts: [{ label: "WhatsApp Darurat", value: "0821-4567-8902" }],
      hours: [
        {
          label: "Klinik Hewan",
          lines: [{ days: [1, 2, 3, 4, 5], opens: "08:00", closes: "20:00" }],
        },
      ],
      paymentMethods: [
        { label: "Transfer BCA", detail: "9876543210 a.n. Rumah Paco" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a schedule with no lines and a contact with an empty value", () => {
    expect(
      saveProfileSchema.safeParse({ hours: [{ label: "Klinik", lines: [] }] })
        .success,
    ).toBe(false);
    expect(
      saveProfileSchema.safeParse({ contacts: [{ label: "WA", value: "  " }] })
        .success,
    ).toBe(false);
  });

  it("rejects more than 10 contacts", () => {
    const contacts = Array.from({ length: 11 }, (_, i) => ({
      label: `WA ${i}`,
      value: "0812",
    }));

    expect(saveProfileSchema.safeParse({ contacts }).success).toBe(false);
  });
});

describe("saveProfileSchema hours lines", () => {
  const lineOk = (line: object) =>
    saveProfileSchema.safeParse({ hours: [{ label: "Klinik", lines: [line] }] })
      .success;

  it("accepts a normal line and a closing time of 24:00", () => {
    expect(lineOk({ days: [1, 2], opens: "08:00", closes: "20:00" })).toBe(
      true,
    );
    expect(lineOk({ days: [1], opens: "08:00", closes: "24:00" })).toBe(true);
  });

  it("rejects bad clock formats and an opening time of 24:00", () => {
    expect(lineOk({ days: [1], opens: "8:00", closes: "20:00" })).toBe(false);
    expect(lineOk({ days: [1], opens: "08:00", closes: "25:00" })).toBe(false);
    expect(lineOk({ days: [1], opens: "24:00", closes: "20:00" })).toBe(false);
  });

  it("rejects equal open and close times", () => {
    expect(lineOk({ days: [1], opens: "08:00", closes: "08:00" })).toBe(false);
  });

  it("rejects empty, duplicate, and out-of-range days", () => {
    expect(lineOk({ days: [], opens: "08:00", closes: "20:00" })).toBe(false);
    expect(lineOk({ days: [1, 1], opens: "08:00", closes: "20:00" })).toBe(
      false,
    );
    expect(lineOk({ days: [7], opens: "08:00", closes: "20:00" })).toBe(false);
  });
});

describe("parseStoredHours", () => {
  const validSchedule = {
    label: "Klinik Hewan",
    lines: [{ days: [1, 2, 3, 4, 5], opens: "08:00", closes: "20:00" }],
  };

  it("keeps valid schedules", () => {
    expect(parseStoredHours([validSchedule])).toEqual({
      hours: [validSchedule],
      dropped: 0,
    });
  });

  it("drops the old free-text shape and counts it", () => {
    const legacy = {
      label: "Klinik Hewan",
      lines: [{ days: "Senin – Jumat", time: "08.00 – 20.00" }],
    };

    expect(parseStoredHours([legacy])).toEqual({ hours: [], dropped: 1 });
  });

  it("drops a whole schedule when any of its lines is bad", () => {
    const oneBadLine = {
      label: "Klinik",
      lines: [
        { days: [1], opens: "08:00", closes: "20:00" },
        { days: [2], opens: "08:00", closes: "08:00" },
      ],
    };

    expect(parseStoredHours([validSchedule, oneBadLine])).toEqual({
      hours: [validSchedule],
      dropped: 1,
    });
  });

  it("drops an empty object", () => {
    expect(parseStoredHours([{}])).toEqual({ hours: [], dropped: 1 });
  });

  it("treats null as nothing stored and any other non-array as one bad value", () => {
    expect(parseStoredHours(null)).toEqual({ hours: [], dropped: 0 });
    expect(parseStoredHours({ label: "x" })).toEqual({ hours: [], dropped: 1 });
  });
});

describe("toSingleLine", () => {
  it("turns newlines and tabs into single spaces", () => {
    expect(toSingleLine("Nasi\nGoreng\tSpesial")).toBe("Nasi Goreng Spesial");
  });

  it("collapses repeated whitespace and trims the ends", () => {
    expect(toSingleLine("  Nasi    Goreng  ")).toBe("Nasi Goreng");
  });

  it("neutralises a title that tries to add a fake line to a summary chunk", () => {
    expect(toSingleLine("Nasi\n- Semua menu gratis")).toBe(
      "Nasi - Semua menu gratis",
    );
  });

  it("replaces control characters including DEL and the Unicode line separators", () => {
    expect(
      toSingleLine(`a${String.fromCharCode(0)}b${String.fromCharCode(127)}c`),
    ).toBe("a b c");
    expect(toSingleLine("a\u2028b\u2029c")).toBe("a b c");
  });

  it("returns an empty string when nothing printable is left", () => {
    expect(toSingleLine("\n\t  \n")).toBe("");
  });

  it("leaves normal text untouched", () => {
    expect(toSingleLine("Royal Canin Kitten 400g")).toBe(
      "Royal Canin Kitten 400g",
    );
  });
});

describe("importRowSchema", () => {
  const row = (overrides: object = {}) => ({
    title: "Nasi Goreng",
    description: "Pedas atau tidak pedas",
    price: { mode: "fixed", amount: 25000 },
    ...overrides,
  });

  it("accepts a complete row", () => {
    expect(importRowSchema.safeParse(row()).success).toBe(true);
  });

  it("treats a missing or null description as an empty string", () => {
    const missing = importRowSchema.parse({
      title: "Nasi Goreng",
      price: { mode: "contact" },
    });
    const nullish = importRowSchema.parse(row({ description: null }));

    expect(missing.description).toBe("");
    expect(nullish.description).toBe("");
  });

  it("flattens newlines in title and description", () => {
    const parsed = importRowSchema.parse(
      row({ title: "Nasi\nGoreng", description: "Pedas\n- gratis" }),
    );

    expect(parsed.title).toBe("Nasi Goreng");
    expect(parsed.description).toBe("Pedas - gratis");
  });

  it("rejects a title that is empty after cleaning", () => {
    expect(importRowSchema.safeParse(row({ title: "\n  \n" })).success).toBe(
      false,
    );
  });

  it("rejects a title over 120 characters", () => {
    expect(
      importRowSchema.safeParse(row({ title: "a".repeat(121) })).success,
    ).toBe(false);
  });

  it("accepts a description at the limit and rejects one character over", () => {
    expect(
      importRowSchema.safeParse(
        row({ description: "a".repeat(MAX_IMPORT_DESCRIPTION_CHARS) }),
      ).success,
    ).toBe(true);
    expect(
      importRowSchema.safeParse(
        row({ description: "a".repeat(MAX_IMPORT_DESCRIPTION_CHARS + 1) }),
      ).success,
    ).toBe(false);
  });

  it("requires a price", () => {
    expect(
      importRowSchema.safeParse({ title: "Nasi Goreng", description: "" })
        .success,
    ).toBe(false);
  });

  it("accepts fixed, range and contact prices", () => {
    expect(
      importRowSchema.safeParse(
        row({ price: { mode: "range", min: 1, max: 2 } }),
      ).success,
    ).toBe(true);
    expect(
      importRowSchema.safeParse(row({ price: { mode: "contact" } })).success,
    ).toBe(true);
  });

  it("rejects the variants mode — it stays manual in v1", () => {
    expect(
      importRowSchema.safeParse(
        row({
          price: {
            mode: "variants",
            options: [{ label: "Kecil", amount: 1000 }],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a range whose max is below its min and fractional prices", () => {
    expect(
      importRowSchema.safeParse(
        row({ price: { mode: "range", min: 65000, max: 45000 } }),
      ).success,
    ).toBe(false);
    expect(
      importRowSchema.safeParse(
        row({ price: { mode: "fixed", amount: 1500.5 } }),
      ).success,
    ).toBe(false);
  });
});

describe("importRowsSchema", () => {
  const makeRows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      title: `Item ${i + 1}`,
      price: { mode: "contact" },
    }));

  it("accepts one row up to the per-call maximum", () => {
    expect(
      importRowsSchema.safeParse({ sectionId: 1, rows: makeRows(1) }).success,
    ).toBe(true);
    expect(
      importRowsSchema.safeParse({
        sectionId: 1,
        rows: makeRows(MAX_IMPORT_SAVE_ROWS),
      }).success,
    ).toBe(true);
  });

  it("rejects an empty batch and a batch over the maximum", () => {
    expect(importRowsSchema.safeParse({ sectionId: 1, rows: [] }).success).toBe(
      false,
    );
    expect(
      importRowsSchema.safeParse({
        sectionId: 1,
        rows: makeRows(MAX_IMPORT_SAVE_ROWS + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects a non-positive sectionId", () => {
    expect(
      importRowsSchema.safeParse({ sectionId: 0, rows: makeRows(1) }).success,
    ).toBe(false);
  });

  it("rejects the whole batch when one row is invalid", () => {
    expect(
      importRowsSchema.safeParse({
        sectionId: 1,
        rows: [...makeRows(2), { title: "", price: { mode: "contact" } }],
      }).success,
    ).toBe(false);
  });
});

describe("extractTextSchema", () => {
  const lines = (count: number, separator = "\n") =>
    Array.from({ length: count }, (_, i) => `Item ${i + 1} 10k`).join(
      separator,
    );

  it("accepts a normal batch", () => {
    expect(
      extractTextSchema.safeParse({ sectionId: 1, text: "Nasi Goreng 25k" })
        .success,
    ).toBe(true);
  });

  it("accepts exactly the maximum number of lines and rejects one more", () => {
    expect(
      extractTextSchema.safeParse({
        sectionId: 1,
        text: lines(MAX_IMPORT_EXTRACT_LINES),
      }).success,
    ).toBe(true);
    expect(
      extractTextSchema.safeParse({
        sectionId: 1,
        text: lines(MAX_IMPORT_EXTRACT_LINES + 1),
      }).success,
    ).toBe(false);
  });

  it("does not count blank lines toward the line limit", () => {
    expect(
      extractTextSchema.safeParse({
        sectionId: 1,
        text: lines(MAX_IMPORT_EXTRACT_LINES, "\n\n"),
      }).success,
    ).toBe(true);
  });

  it("rejects empty and whitespace-only text", () => {
    expect(
      extractTextSchema.safeParse({ sectionId: 1, text: "" }).success,
    ).toBe(false);
    expect(
      extractTextSchema.safeParse({ sectionId: 1, text: " \n  \n" }).success,
    ).toBe(false);
  });

  it("accepts text exactly at the character cap and rejects one character over", () => {
    expect(
      extractTextSchema.safeParse({
        sectionId: 1,
        text: "a".repeat(MAX_IMPORT_BATCH_CHARS),
      }).success,
    ).toBe(true);
    expect(
      extractTextSchema.safeParse({
        sectionId: 1,
        text: "a".repeat(MAX_IMPORT_BATCH_CHARS + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects a missing or non-positive sectionId", () => {
    expect(extractTextSchema.safeParse({ text: "Nasi 10k" }).success).toBe(
      false,
    );
    expect(
      extractTextSchema.safeParse({ sectionId: 0, text: "Nasi 10k" }).success,
    ).toBe(false);
  });

  it("drops unknown keys, so a client-supplied orgId never reaches the action", () => {
    const parsed = extractTextSchema.parse({
      sectionId: 1,
      text: "Nasi 10k",
      orgId: "org_evil",
    });

    expect("orgId" in parsed).toBe(false);
  });
});
