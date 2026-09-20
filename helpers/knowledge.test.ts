// Unit tests for helpers/knowledge.ts
// Pure functions — no mocks needed
// Fixtures come from the two real sample documents (Kedai Bu Sari, Rumah Paco)

import { describe, it, expect } from "vitest";
import {
  compileEntryChunks,
  compileProfileBlock,
  compileSectionSummaryChunks,
  formatEntryPrice,
  buildSyncItems,
  buildSectionSnapshot,
  toSyncStatus,
} from "./knowledge";
import type {
  CompileEntry,
  CompileProfile,
  CompileSection,
  EntryPrice,
} from "@/types/knowledge";

// Small factories — keep each test focused on what it actually checks
const makeSection = (
  overrides: Partial<CompileSection> = {},
): CompileSection => ({
  kind: "catalog",
  title: "Menu Sarapan",
  note: "Tersedia 07.00 – 10.00",
  ...overrides,
});

const makeEntry = (overrides: Partial<CompileEntry> = {}): CompileEntry => ({
  title: "Nasi Kuning Komplit",
  body: "",
  price: { mode: "fixed", amount: 18000 },
  isAvailable: true,
  ...overrides,
});

// Weight-tiered price straight from Rumah Paco's cat spay
const spayPrice: EntryPrice = {
  mode: "variants",
  options: [
    { label: "Di bawah 3 kg", amount: 500000 },
    { label: "3–5 kg", amount: 600000 },
    { label: "Di atas 5 kg", amount: 700000 },
  ],
};

describe("formatEntryPrice", () => {
  it("formats a fixed price", () => {
    expect(formatEntryPrice({ mode: "fixed", amount: 25000 })).toBe(
      "Rp 25.000",
    );
  });

  it("formats a range (Bu Sari's ikan bakar)", () => {
    expect(formatEntryPrice({ mode: "range", min: 45000, max: 65000 })).toBe(
      "Rp 45.000 – Rp 65.000",
    );
  });

  it("formats variants with every option", () => {
    expect(formatEntryPrice(spayPrice)).toBe(
      "Di bawah 3 kg: Rp 500.000; 3–5 kg: Rp 600.000; Di atas 5 kg: Rp 700.000",
    );
  });

  it("collapses variants to the lowest price in compact mode", () => {
    expect(formatEntryPrice(spayPrice, true)).toBe("mulai Rp 500.000");
  });

  it("says to contact the business for contact mode", () => {
    expect(formatEntryPrice({ mode: "contact" })).toBe(
      "Hubungi kami untuk harga",
    );
  });

  it("falls back to contact wording when variants has no options", () => {
    expect(formatEntryPrice({ mode: "variants", options: [] })).toBe(
      "Hubungi kami untuk harga",
    );
  });

  it("shows Gratis for a zero price (reuses formatRupiah)", () => {
    expect(formatEntryPrice({ mode: "fixed", amount: 0 })).toBe("Gratis");
  });
});

describe("compileEntryChunks", () => {
  it("includes path, price, section note, and body for a catalog item", () => {
    const chunks = compileEntryChunks(
      makeSection(),
      makeEntry({ body: "Nasi kuning dengan lauk pilihan — telur balado." }),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Menu Sarapan › Nasi Kuning Komplit");
    expect(chunks[0]).toContain("Harga: Rp 18.000");
    expect(chunks[0]).toContain("Catatan: Tersedia 07.00 – 10.00");
    expect(chunks[0]).toContain("telur balado");
  });

  it("produces the exact expected text when the body is empty", () => {
    const chunks = compileEntryChunks(
      makeSection(),
      makeEntry({
        title: "Bubur Ayam Kalimantan",
        price: { mode: "fixed", amount: 14000 },
      }),
    );

    expect(chunks).toEqual([
      "Menu Sarapan › Bubur Ayam Kalimantan\nHarga: Rp 14.000\nCatatan: Tersedia 07.00 – 10.00",
    ]);
  });

  it("writes every weight tier and omits Catatan when the section has no note", () => {
    const chunks = compileEntryChunks(
      makeSection({ title: "Sterilisasi dan Kastrasi", note: null }),
      makeEntry({ title: "Sterilisasi Kucing Betina", price: spayPrice }),
    );

    expect(chunks[0]).toContain("Di bawah 3 kg: Rp 500.000");
    expect(chunks[0]).toContain("Di atas 5 kg: Rp 700.000");
    expect(chunks[0]).not.toContain("Catatan:");
  });

  it("marks an unavailable catalog item instead of dropping it", () => {
    const chunks = compileEntryChunks(
      makeSection(),
      makeEntry({ isAvailable: false }),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Status: sedang tidak tersedia");
  });

  it("uses question / answer format for FAQ entries", () => {
    const chunks = compileEntryChunks(
      makeSection({ kind: "faq", title: "FAQ", note: null }),
      makeEntry({
        title: "Apakah ada parkir?",
        body: "Parkir motor gratis di halaman kedai.",
        price: null,
      }),
    );

    expect(chunks).toEqual([
      "Pertanyaan: Apakah ada parkir?\nJawaban: Parkir motor gratis di halaman kedai.",
    ]);
  });

  it("returns no chunks for a disabled non-catalog entry (ended promo)", () => {
    const chunks = compileEntryChunks(
      makeSection({ kind: "promo", title: "Promo", note: null }),
      makeEntry({
        title: "Promo Senin Hemat",
        price: null,
        isAvailable: false,
      }),
    );

    expect(chunks).toEqual([]);
  });

  it("omits the price line for entries without a price", () => {
    const chunks = compileEntryChunks(
      makeSection({ kind: "policy", title: "Kebijakan", note: null }),
      makeEntry({
        title: "Pembatalan",
        body: "Pembatalan kurang dari 24 jam dikenakan biaya Rp 50.000.",
        price: null,
      }),
    );

    expect(chunks[0]).not.toContain("Harga:");
    expect(chunks[0]).toContain("Kebijakan › Pembatalan");
  });

  it("splits a very long body and repeats the head on every piece", () => {
    const longBody = "Kalimat panjang untuk pengujian pembagian chunk. ".repeat(
      120,
    );
    const chunks = compileEntryChunks(
      makeSection({ kind: "policy", title: "Kebijakan", note: null }),
      makeEntry({ title: "Pembatalan", body: longBody, price: null }),
    );

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.startsWith("Kebijakan › Pembatalan\n")).toBe(true);
    });
  });

  it("trims stray whitespace from title and body", () => {
    const chunks = compileEntryChunks(
      makeSection({ kind: "note", title: "Info", note: null }),
      makeEntry({
        title: "  Wifi  ",
        body: "  Gratis, password di kasir.  ",
        price: null,
      }),
    );

    expect(chunks).toEqual(["Info › Wifi\nGratis, password di kasir."]);
  });
});

describe("compileSectionSummaryChunks", () => {
  const breakfast = [
    makeEntry({
      title: "Nasi Kuning Komplit",
      price: { mode: "fixed", amount: 18000 },
    }),
    makeEntry({
      title: "Bubur Ayam Kalimantan",
      price: { mode: "fixed", amount: 14000 },
    }),
    makeEntry({
      title: "Lontong Sayur",
      price: { mode: "fixed", amount: 15000 },
    }),
  ];

  it("returns nothing for non-catalog sections", () => {
    expect(
      compileSectionSummaryChunks(makeSection({ kind: "faq" }), breakfast),
    ).toEqual([]);
  });

  it("returns nothing for a section with fewer than 2 entries", () => {
    expect(
      compileSectionSummaryChunks(makeSection(), [
        breakfast[0] as CompileEntry,
      ]),
    ).toEqual([]);
  });

  it("builds one list chunk with every item and the section note", () => {
    expect(compileSectionSummaryChunks(makeSection(), breakfast)).toEqual([
      "Daftar lengkap Menu Sarapan\nCatatan: Tersedia 07.00 – 10.00\n- Nasi Kuning Komplit: Rp 18.000\n- Bubur Ayam Kalimantan: Rp 14.000\n- Lontong Sayur: Rp 15.000",
    ]);
  });

  it("uses the compact price for variants", () => {
    const chunks = compileSectionSummaryChunks(makeSection({ note: null }), [
      makeEntry({ title: "Sterilisasi Kucing Betina", price: spayPrice }),
      makeEntry({
        title: "Kastrasi Kucing Jantan",
        price: { mode: "fixed", amount: 300000 },
      }),
    ]);

    expect(chunks[0]).toContain(
      "- Sterilisasi Kucing Betina: mulai Rp 500.000",
    );
  });

  it("marks unavailable items in the list", () => {
    const chunks = compileSectionSummaryChunks(makeSection(), [
      breakfast[0] as CompileEntry,
      makeEntry({ title: "Lontong Sayur", isAvailable: false }),
    ]);

    expect(chunks[0]).toContain(
      "- Lontong Sayur: Rp 18.000 (sedang tidak tersedia)",
    );
  });

  it("splits a long list into several chunks that keep the header and stay under the cap", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      makeEntry({
        title: `Menu nomor ${i + 1}`,
        price: { mode: "fixed", amount: 10000 + i },
      }),
    );
    const chunks = compileSectionSummaryChunks(makeSection(), many);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1]).toContain("(lanjutan 2)");

    // Every item appears exactly once across all chunks
    const listedLines = chunks
      .join("\n")
      .split("\n")
      .filter((line) => line.startsWith("- "));
    expect(listedLines).toHaveLength(60);

    chunks.forEach((chunk) => {
      expect(chunk.startsWith("Daftar lengkap Menu Sarapan")).toBe(true);
      expect(chunk.length).toBeLessThanOrEqual(800);
    });
  });
});

describe("compileProfileBlock", () => {
  const empty: CompileProfile = {
    about: null,
    address: null,
    contacts: [],
    hours: [],
    paymentMethods: [],
  };

  it("returns null when nothing is filled in", () => {
    expect(compileProfileBlock(empty)).toBeNull();
  });

  it("treats whitespace-only text as empty", () => {
    expect(
      compileProfileBlock({ ...empty, about: "   ", address: "  " }),
    ).toBeNull();
  });

  it("compiles a full Rumah Paco-style profile", () => {
    const block = compileProfileBlock({
      about: "Klinik hewan dan pet shop lengkap.",
      address: "Jalan Kesehatan No. 12, Samarinda",
      contacts: [
        { label: "WhatsApp Klinik", value: "0821-4567-8901" },
        { label: "WhatsApp Darurat", value: "0821-4567-8902" },
      ],
      hours: [
        {
          label: "Klinik Hewan",
          lines: [
            { days: "Senin – Jumat", time: "08.00 – 20.00" },
            { days: "Minggu", time: "09.00 – 15.00", note: "dokter terbatas" },
          ],
        },
        {
          label: "Pet Shop",
          lines: [{ days: "Minggu", time: "10.00 – 15.00" }],
        },
      ],
      paymentMethods: [
        { label: "Tunai" },
        { label: "Transfer BCA", detail: "9876543210 a.n. Rumah Paco" },
      ],
    });

    const text = block ?? "";
    const lines = text.split("\n");

    expect(block).not.toBeNull();
    expect(text).toContain("Alamat: Jalan Kesehatan No. 12, Samarinda");
    expect(lines).toContain("- WhatsApp Darurat: 0821-4567-8902");
    expect(lines).toContain("- Klinik Hewan");
    expect(lines).toContain("  Minggu: 09.00 – 15.00 (dokter terbatas)");
    expect(lines).toContain("- Pet Shop");
    expect(lines).toContain("  Minggu: 10.00 – 15.00");
    expect(lines).toContain("- Tunai");
    expect(lines).toContain("- Transfer BCA: 9876543210 a.n. Rumah Paco");
  });

  it("skips sections that are empty", () => {
    const block = compileProfileBlock({
      ...empty,
      address: "Jalan Pramuka No. 47, Samarinda",
    });

    expect(block).toBe("Alamat: Jalan Pramuka No. 47, Samarinda");
  });
});

describe("buildSyncItems", () => {
  const section = makeSection();
  const entries = [
    { ...makeEntry({ title: "Nasi Kuning Komplit" }), id: 1 },
    {
      ...makeEntry({
        title: "Bubur Ayam Kalimantan",
        price: { mode: "fixed", amount: 14000 },
      }),
      id: 2,
    },
    {
      ...makeEntry({
        title: "Lontong Sayur",
        price: { mode: "fixed", amount: 15000 },
      }),
      id: 3,
    },
  ];

  it("gives the target entry its own chunk and the section its summary", () => {
    const items = buildSyncItems(section, entries, [2], 10);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ entryId: 2, sectionId: null });
    expect(items[0]?.content).toContain("Bubur Ayam Kalimantan");
    expect(items[1]).toMatchObject({ entryId: null, sectionId: 10 });
  });

  it("builds the summary from ALL entries even when only one is a target", () => {
    const summary = buildSyncItems(section, entries, [2], 10)[1]?.content ?? "";

    expect(summary).toContain("Nasi Kuning Komplit");
    expect(summary).toContain("Bubur Ayam Kalimantan");
    expect(summary).toContain("Lontong Sayur");
  });

  it("builds only the summary when there are no targets", () => {
    const items = buildSyncItems(section, entries, [], 10);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ entryId: null, sectionId: 10 });
  });

  it("puts every entry chunk before the summary when all entries are targets", () => {
    const items = buildSyncItems(section, entries, [1, 2, 3], 10);

    expect(items.map((item) => item.entryId)).toEqual([1, 2, 3, null]);
  });

  it("skips disabled non-catalog entries and never builds a summary for them", () => {
    const promoSection = makeSection({
      kind: "promo",
      title: "Promo",
      note: null,
    });
    const promoEntries = [
      {
        ...makeEntry({ title: "Promo Senin", price: null, isAvailable: false }),
        id: 1,
      },
      { ...makeEntry({ title: "Promo Keluarga", price: null }), id: 2 },
    ];
    const items = buildSyncItems(promoSection, promoEntries, [1, 2], 10);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ entryId: 2, sectionId: null });
  });
});

describe("buildSectionSnapshot", () => {
  const t = (n: number) => new Date(n);
  const section = { updatedAt: t(1000) };
  const entries = [
    { id: 1, updatedAt: t(2000) },
    { id: 2, updatedAt: t(3000) },
  ];

  it("is the same for identical data, regardless of row order", () => {
    const reversed = [...entries].reverse();

    expect(buildSectionSnapshot(section, reversed)).toBe(
      buildSectionSnapshot(section, entries),
    );
  });

  it("changes when an entry is saved again", () => {
    const edited = [
      entries[0] as (typeof entries)[number],
      { id: 2, updatedAt: t(3001) },
    ];

    expect(buildSectionSnapshot(section, edited)).not.toBe(
      buildSectionSnapshot(section, entries),
    );
  });

  it("changes when an entry is deleted or added", () => {
    expect(buildSectionSnapshot(section, entries.slice(0, 1))).not.toBe(
      buildSectionSnapshot(section, entries),
    );
    expect(
      buildSectionSnapshot(section, [
        ...entries,
        { id: 3, updatedAt: t(4000) },
      ]),
    ).not.toBe(buildSectionSnapshot(section, entries));
  });

  it("changes when the section itself is saved again", () => {
    expect(buildSectionSnapshot({ updatedAt: t(1001) }, entries)).not.toBe(
      buildSectionSnapshot(section, entries),
    );
  });
});

describe("toSyncStatus", () => {
  it("is synced only when the sync finished", () => {
    expect(toSyncStatus({ status: "synced", chunkCount: 3 })).toBe("synced");
  });

  it("is stale for every other outcome", () => {
    expect(toSyncStatus({ status: "superseded" })).toBe("stale");
    expect(toSyncStatus({ status: "embed_failed" })).toBe("stale");
    expect(toSyncStatus({ status: "not_found" })).toBe("stale");
  });
});
