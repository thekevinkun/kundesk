// Unit tests for helpers/knowledge-schemas.ts
// Pure Zod parsing — no mocks needed

import { describe, it, expect } from "vitest";
import {
  createEntrySchema,
  createSectionSchema,
  entryPriceSchema,
  saveProfileSchema,
  setEntryAvailabilitySchema,
} from "./knowledge-schemas";

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
          lines: [{ days: "Senin – Jumat", time: "08.00 – 20.00" }],
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
