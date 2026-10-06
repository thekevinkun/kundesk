// Tests for the knowledge sync orchestration: load → compile → embed (outside the lock) →
// swap chunks in ONE transaction, guarded by a fingerprint recheck ("superseded").
// The pure compile functions (helpers/knowledge) are real here, not mocked — only the DB,
// the embedder and Sentry are faked.
// NOTE: row locking (FOR UPDATE), real transaction rollback and the SQL itself cannot be
// verified with mocks (rule 262). These tests pin the control flow and the contract with
// callers: what gets deleted, what gets written, what is marked synced, and what is returned.
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { chunks, knowledgeEntries, knowledgeSections } from "@/lib/db/schema";
import { syncEntry, syncSection, syncSectionSummary } from "./sync";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockDb = vi.hoisted(() => ({ select: vi.fn(), transaction: vi.fn() }));
const mockEmbed = vi.hoisted(() => vi.fn());
const spies = vi.hoisted(() => ({
  outerWhere: vi.fn(), // where() arguments of the loads outside the transaction
  txWhere: vi.fn(), // where() arguments of the locking selects inside it
  forLock: vi.fn(), // the lock mode passed to .for()
  txSelect: vi.fn(),
  txDelete: vi.fn(),
  txInsert: vi.fn(),
  txUpdate: vi.fn(),
  deleteWhere: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/ai/embed", () => ({ embedTexts: mockEmbed }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
// Operators become plain data so tests can assert the exact filters that were built
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ op: "and", args }),
  or: (...args: unknown[]) => ({ op: "or", args }),
  eq: (a: unknown, b: unknown) => ({ op: "eq", a, b }),
  inArray: (a: unknown, b: unknown) => ({ op: "inArray", a, b }),
  asc: (a: unknown) => ({ op: "asc", a }),
}));
// Columns are just their own names — enough to tell filters apart
vi.mock("@/lib/db/schema", () => ({
  chunks: {
    orgId: "chunks.orgId",
    entryId: "chunks.entryId",
    sectionId: "chunks.sectionId",
  },
  knowledgeEntries: {
    id: "entries.id",
    orgId: "entries.orgId",
    sectionId: "entries.sectionId",
    sortOrder: "entries.sortOrder",
    updatedAt: "entries.updatedAt",
    syncStatus: "entries.syncStatus",
  },
  knowledgeSections: {
    id: "sections.id",
    orgId: "sections.orgId",
    updatedAt: "sections.updatedAt",
  },
}));

const mockCaptureException = vi.mocked(Sentry.captureException);

const ORG = "org_a";
const SECTION_ID = 1;
const T0 = new Date("2026-10-01T00:00:00.000Z");
const T1 = new Date("2026-10-02T00:00:00.000Z");

type Row = Record<string, unknown>;

function sectionRow(overrides: Row = {}): Row {
  return {
    id: SECTION_ID,
    orgId: ORG,
    kind: "catalog",
    title: "Menu Sarapan",
    note: null,
    updatedAt: T0,
    ...overrides,
  };
}

function entryRow(
  id: number,
  title: string,
  overrides: Row = {},
): Row & { id: number; updatedAt: Date } {
  return {
    id,
    sectionId: SECTION_ID,
    orgId: ORG,
    title,
    body: "",
    price: { mode: "fixed", amount: 25000 },
    isAvailable: true,
    sortOrder: id,
    syncStatus: "stale",
    updatedAt: T0,
    ...overrides,
  } as Row & { id: number; updatedAt: Date };
}

// Outside the transaction: db.select().from().where() ends in .limit() (section, entry lookup)
// or .orderBy() (the entries list) — both resolve to the same rows here
function queueSelect(rows: Row[]): void {
  mockDb.select.mockReturnValueOnce({
    from: () => ({
      where: (arg: unknown) => {
        spies.outerWhere(arg);
        return {
          limit: () => Promise.resolve(rows),
          orderBy: () => Promise.resolve(rows),
        };
      },
    }),
  });
}

// Inside the transaction: tx.select().from().where().for("update")
function queueTxSelect(rows: Row[]): void {
  spies.txSelect.mockReturnValueOnce({
    from: () => ({
      where: (arg: unknown) => {
        spies.txWhere(arg);
        return {
          for: (mode: string) => {
            spies.forLock(mode);
            return Promise.resolve(rows);
          },
        };
      },
    }),
  });
}

type Locked = {
  section?: Row[];
  entries?: Row[];
};

// Queues the two loads (section, entries) and the two locking re-reads. By default the locked
// rows carry the SAME updatedAt as the loaded ones, so the fingerprint matches.
function arrange(
  section: Row,
  entries: Array<Row & { id: number; updatedAt: Date }>,
  locked: Locked = {},
): void {
  queueSelect([section]);
  queueSelect(entries);
  queueTxSelect(locked.section ?? [{ updatedAt: section.updatedAt }]);
  queueTxSelect(
    locked.entries ??
      entries.map((e) => ({ id: e.id, updatedAt: e.updatedAt })),
  );
}

// Filters the code is expected to build
const sectionLoadFilter = {
  op: "and",
  args: [
    { op: "eq", a: knowledgeSections.id, b: SECTION_ID },
    { op: "eq", a: knowledgeSections.orgId, b: ORG },
  ],
};
const entriesLoadFilter = {
  op: "and",
  args: [
    { op: "eq", a: knowledgeEntries.sectionId, b: SECTION_ID },
    { op: "eq", a: knowledgeEntries.orgId, b: ORG },
  ],
};
const summaryOnlyFilter = { op: "eq", a: chunks.sectionId, b: SECTION_ID };
function deleteFilter(ownerFilter: unknown): unknown {
  return {
    op: "and",
    args: [{ op: "eq", a: chunks.orgId, b: ORG }, ownerFilter],
  };
}
function entriesOrSummaryFilter(ids: number[]): unknown {
  return {
    op: "or",
    args: [{ op: "inArray", a: chunks.entryId, b: ids }, summaryOnlyFilter],
  };
}

describe("knowledge sync", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Embedder: one distinct vector per input text
    mockEmbed.mockImplementation(async (texts: string[]) =>
      texts.map((_, i) => [i, i + 0.5]),
    );

    // The fake transaction handle
    const tx = {
      select: spies.txSelect,
      delete: spies.txDelete,
      insert: spies.txInsert,
      update: spies.txUpdate,
    };
    mockDb.transaction.mockImplementation(
      async (callback: (handle: typeof tx) => Promise<unknown>) => callback(tx),
    );
    spies.txDelete.mockReturnValue({ where: spies.deleteWhere });
    spies.deleteWhere.mockResolvedValue(undefined);
    spies.txInsert.mockReturnValue({ values: spies.insertValues });
    spies.insertValues.mockResolvedValue(undefined);
    spies.txUpdate.mockReturnValue({ set: spies.updateSet });
    spies.updateSet.mockReturnValue({ where: spies.updateWhere });
    spies.updateWhere.mockResolvedValue(undefined);
  });

  describe("syncSection (rebuild everything)", () => {
    it("returns not_found for a missing section, without embedding or opening a transaction", async () => {
      queueSelect([]);

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "not_found" });
      expect(mockEmbed).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("scopes both loads to the org (tenant isolation)", async () => {
      arrange(sectionRow(), [entryRow(1, "Nasi Uduk")]);

      await syncSection(ORG, SECTION_ID);

      expect(spies.outerWhere).toHaveBeenNthCalledWith(1, sectionLoadFilter);
      expect(spies.outerWhere).toHaveBeenNthCalledWith(2, entriesLoadFilter);
      // The locking re-reads are scoped the same way
      expect(spies.txWhere).toHaveBeenNthCalledWith(1, sectionLoadFilter);
      expect(spies.txWhere).toHaveBeenNthCalledWith(2, entriesLoadFilter);
    });

    it("catalog with 2 entries: one chunk per entry plus a summary, embedded in a single batch", async () => {
      arrange(sectionRow(), [
        entryRow(1, "Nasi Uduk"),
        entryRow(2, "Lontong Sayur"),
      ]);

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "synced", chunkCount: 3 });
      expect(mockEmbed).toHaveBeenCalledTimes(1);
      const texts = mockEmbed.mock.calls[0]?.[0] as string[];
      expect(texts).toHaveLength(3);
      expect(texts[0]).toContain("Menu Sarapan › Nasi Uduk");
      expect(texts[1]).toContain("Menu Sarapan › Lontong Sayur");
      expect(texts[2]).toContain("Daftar lengkap Menu Sarapan");
    });

    it("inserts entry chunks owned by their entry and the summary owned by the section", async () => {
      arrange(sectionRow(), [
        entryRow(1, "Nasi Uduk"),
        entryRow(2, "Lontong Sayur"),
      ]);

      await syncSection(ORG, SECTION_ID);

      expect(spies.insertValues).toHaveBeenCalledTimes(1);
      expect(spies.insertValues).toHaveBeenCalledWith([
        // Embedding is stored as a JSON string, same format as document chunks
        {
          orgId: ORG,
          entryId: 1,
          sectionId: null,
          content: expect.stringContaining("Nasi Uduk"),
          embedding: JSON.stringify([0, 0.5]),
        },
        {
          orgId: ORG,
          entryId: 2,
          sectionId: null,
          content: expect.stringContaining("Lontong Sayur"),
          embedding: JSON.stringify([1, 1.5]),
        },
        {
          orgId: ORG,
          entryId: null,
          sectionId: SECTION_ID,
          content: expect.stringContaining("Daftar lengkap Menu Sarapan"),
          embedding: JSON.stringify([2, 2.5]),
        },
      ]);
    });

    it("deletes the old chunks of every entry plus the section summary, scoped to the org", async () => {
      arrange(sectionRow(), [
        entryRow(1, "Nasi Uduk"),
        entryRow(2, "Lontong Sayur"),
      ]);

      await syncSection(ORG, SECTION_ID);

      expect(spies.deleteWhere).toHaveBeenCalledWith(
        deleteFilter(entriesOrSummaryFilter([1, 2])),
      );
    });

    it("marks every rebuilt entry synced, and ONLY changes syncStatus (never updatedAt)", async () => {
      arrange(sectionRow(), [
        entryRow(1, "Nasi Uduk"),
        entryRow(2, "Lontong Sayur"),
      ]);

      await syncSection(ORG, SECTION_ID);

      // Touching updatedAt would invalidate the fingerprint of a concurrent sync
      expect(spies.updateSet).toHaveBeenCalledWith({ syncStatus: "synced" });
      expect(spies.updateWhere).toHaveBeenCalledWith({
        op: "and",
        args: [
          { op: "eq", a: knowledgeEntries.orgId, b: ORG },
          { op: "inArray", a: knowledgeEntries.id, b: [1, 2] },
        ],
      });
    });

    it("a catalog section with a single entry gets no summary chunk", async () => {
      arrange(sectionRow(), [entryRow(1, "Nasi Uduk")]);

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "synced", chunkCount: 1 });
      expect(mockEmbed.mock.calls[0]?.[0]).toHaveLength(1);
    });

    it("a FAQ section gets one chunk per entry and never a summary", async () => {
      arrange(sectionRow({ kind: "faq", title: "FAQ" }), [
        entryRow(1, "Bisa antar?", {
          body: "Bisa, gratis ongkir.",
          price: null,
        }),
        entryRow(2, "Buka hari Minggu?", { body: "Buka.", price: null }),
      ]);

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "synced", chunkCount: 2 });
      const texts = mockEmbed.mock.calls[0]?.[0] as string[];
      expect(texts[0]).toContain("Pertanyaan: Bisa antar?");
      expect(texts.some((t) => t.includes("Daftar lengkap"))).toBe(false);
    });

    it("a disabled non-catalog entry compiles to zero chunks but its old chunk is still removed and it is still marked synced", async () => {
      arrange(sectionRow({ kind: "promo", title: "Promo" }), [
        entryRow(1, "Diskon Lebaran", { price: null, isAvailable: false }),
      ]);

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "synced", chunkCount: 0 });
      // Nothing to insert, but the stale chunk must still be deleted
      expect(spies.deleteWhere).toHaveBeenCalledTimes(1);
      expect(spies.insertValues).not.toHaveBeenCalled();
      expect(spies.updateSet).toHaveBeenCalledWith({ syncStatus: "synced" });
    });

    // CHARACTERIZATION — an empty section still calls the embedder with an empty list
    it("a section with no entries clears its chunks and writes nothing", async () => {
      arrange(sectionRow(), []);

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "synced", chunkCount: 0 });
      expect(mockEmbed).toHaveBeenCalledWith([]);
      // No entries: only the section's summary chunks are targeted
      expect(spies.deleteWhere).toHaveBeenCalledWith(
        deleteFilter(summaryOnlyFilter),
      );
      expect(spies.insertValues).not.toHaveBeenCalled();
      expect(spies.updateSet).not.toHaveBeenCalled();
    });
  });

  describe("syncEntry (one entry + the summary)", () => {
    it("returns not_found when the entry does not exist, without loading the section", async () => {
      queueSelect([]);

      const result = await syncEntry(ORG, 99);

      expect(result).toEqual({ status: "not_found" });
      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(mockEmbed).not.toHaveBeenCalled();
    });

    it("looks the entry up scoped to the org (same not_found for a foreign entry)", async () => {
      queueSelect([]);

      await syncEntry(ORG, 99);

      expect(spies.outerWhere).toHaveBeenCalledWith({
        op: "and",
        args: [
          { op: "eq", a: knowledgeEntries.id, b: 99 },
          { op: "eq", a: knowledgeEntries.orgId, b: ORG },
        ],
      });
    });

    it("rebuilds only the target entry's chunk plus the summary of ALL entries", async () => {
      queueSelect([{ sectionId: SECTION_ID }]);
      arrange(sectionRow(), [
        entryRow(1, "Nasi Uduk"),
        entryRow(2, "Lontong Sayur"),
        entryRow(3, "Bubur Ayam"),
      ]);

      const result = await syncEntry(ORG, 2);

      expect(result).toEqual({ status: "synced", chunkCount: 2 });
      const texts = mockEmbed.mock.calls[0]?.[0] as string[];
      expect(texts).toHaveLength(2);
      expect(texts[0]).toContain("Lontong Sayur");
      // The summary lists every entry, not just the one that changed
      expect(texts[1]).toContain("Nasi Uduk");
      expect(texts[1]).toContain("Bubur Ayam");
      // Only the target is deleted and marked synced
      expect(spies.deleteWhere).toHaveBeenCalledWith(
        deleteFilter(entriesOrSummaryFilter([2])),
      );
      expect(spies.updateWhere).toHaveBeenCalledWith({
        op: "and",
        args: [
          { op: "eq", a: knowledgeEntries.orgId, b: ORG },
          { op: "inArray", a: knowledgeEntries.id, b: [2] },
        ],
      });
    });

    it("an entry deleted since the save drops out of the targets: only the summary is rebuilt", async () => {
      queueSelect([{ sectionId: SECTION_ID }]);
      // Entry 2 exists for the lookup but is gone by the time the entries are loaded
      arrange(sectionRow(), [
        entryRow(1, "Nasi Uduk"),
        entryRow(3, "Bubur Ayam"),
      ]);

      const result = await syncEntry(ORG, 2);

      expect(result).toEqual({ status: "synced", chunkCount: 1 });
      expect(spies.deleteWhere).toHaveBeenCalledWith(
        deleteFilter(summaryOnlyFilter),
      );
      expect(spies.updateSet).not.toHaveBeenCalled();
    });
  });

  describe("syncSectionSummary (summary only)", () => {
    it("rebuilds just the summary, touching no entry chunk and no entry status", async () => {
      arrange(sectionRow(), [
        entryRow(1, "Nasi Uduk"),
        entryRow(2, "Lontong Sayur"),
      ]);

      const result = await syncSectionSummary(ORG, SECTION_ID);

      expect(result).toEqual({ status: "synced", chunkCount: 1 });
      const texts = mockEmbed.mock.calls[0]?.[0] as string[];
      expect(texts).toHaveLength(1);
      expect(texts[0]).toContain("Daftar lengkap Menu Sarapan");
      expect(spies.deleteWhere).toHaveBeenCalledWith(
        deleteFilter(summaryOnlyFilter),
      );
      expect(spies.updateSet).not.toHaveBeenCalled();
    });
  });

  describe("embedding failure", () => {
    it("returns embed_failed, leaves old chunks untouched and reports ids only to Sentry", async () => {
      const boom = new Error("openai down");
      queueSelect([sectionRow()]);
      queueSelect([entryRow(1, "Nasi Uduk"), entryRow(2, "Lontong Sayur")]);
      mockEmbed.mockRejectedValueOnce(boom);

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "embed_failed" });
      // Never opens a transaction, so the old chunks stay searchable
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(spies.deleteWhere).not.toHaveBeenCalled();
      // Only ids go to Sentry — never entry content
      expect(mockCaptureException).toHaveBeenCalledWith(boom, {
        extra: { orgId: ORG, sectionId: SECTION_ID },
      });
    });
  });

  describe("transaction", () => {
    it("embeds BEFORE the transaction opens (a slow OpenAI call never holds a DB lock)", async () => {
      arrange(sectionRow(), [entryRow(1, "Nasi Uduk")]);

      await syncSection(ORG, SECTION_ID);

      const embedOrder = mockEmbed.mock.invocationCallOrder[0] as number;
      const txOrder = mockDb.transaction.mock.invocationCallOrder[0] as number;
      expect(embedOrder).toBeLessThan(txOrder);
    });

    it("locks the section first, then its entries, both FOR UPDATE", async () => {
      arrange(sectionRow(), [entryRow(1, "Nasi Uduk")]);

      await syncSection(ORG, SECTION_ID);

      expect(spies.forLock).toHaveBeenCalledTimes(2);
      expect(spies.forLock).toHaveBeenNthCalledWith(1, "update");
      expect(spies.forLock).toHaveBeenNthCalledWith(2, "update");
      expect(spies.txWhere.mock.invocationCallOrder[0]).toBeLessThan(
        spies.txWhere.mock.invocationCallOrder[1] as number,
      );
    });

    it("swaps in the safe order: delete old chunks → insert new ones → mark entries synced", async () => {
      arrange(sectionRow(), [
        entryRow(1, "Nasi Uduk"),
        entryRow(2, "Lontong Sayur"),
      ]);

      await syncSection(ORG, SECTION_ID);

      const order = [
        spies.deleteWhere.mock.invocationCallOrder[0],
        spies.insertValues.mock.invocationCallOrder[0],
        spies.updateSet.mock.invocationCallOrder[0],
      ] as number[];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("returns not_found, writing nothing, when the section vanished before the lock", async () => {
      arrange(sectionRow(), [entryRow(1, "Nasi Uduk")], { section: [] });

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "not_found" });
      expect(spies.deleteWhere).not.toHaveBeenCalled();
      expect(spies.insertValues).not.toHaveBeenCalled();
      expect(spies.updateSet).not.toHaveBeenCalled();
    });

    // The fingerprint recheck — the safety mechanism behind rule 201. If anything changed while
    // we were embedding, our chunks are outdated: write NOTHING and leave the entries "stale"
    // (the save that changed it runs its own sync).
    it.each([
      ["an entry was edited", { entries: [{ id: 1, updatedAt: T1 }] }],
      ["the section was edited", { section: [{ updatedAt: T1 }] }],
      [
        "a new entry appeared",
        {
          entries: [
            { id: 1, updatedAt: T0 },
            { id: 2, updatedAt: T0 },
          ],
        },
      ],
      ["an entry was deleted", { entries: [] }],
    ] as Array<[string, Locked]>)(
      "returns superseded and writes nothing when %s while embedding",
      async (_label, locked) => {
        arrange(sectionRow(), [entryRow(1, "Nasi Uduk")], locked);

        const result = await syncSection(ORG, SECTION_ID);

        expect(result).toEqual({ status: "superseded" });
        expect(spies.deleteWhere).not.toHaveBeenCalled();
        expect(spies.insertValues).not.toHaveBeenCalled();
        expect(spies.updateSet).not.toHaveBeenCalled();
        // A superseded run is not an error — nothing goes to Sentry
        expect(mockCaptureException).not.toHaveBeenCalled();
      },
    );

    it("is not fooled by row order: the same rows in a different order still match", async () => {
      arrange(
        sectionRow(),
        [entryRow(1, "Nasi Uduk"), entryRow(2, "Lontong Sayur")],
        {
          entries: [
            { id: 2, updatedAt: T0 },
            { id: 1, updatedAt: T0 },
          ],
        },
      );

      const result = await syncSection(ORG, SECTION_ID);

      expect(result).toEqual({ status: "synced", chunkCount: 3 });
    });

    // CHARACTERIZATION — a database error inside the swap is NOT caught: it propagates so the
    // caller sees the failure, the transaction rolls back, and the entries stay "stale"
    it("rethrows a database error from the swap, with no Sentry report from this layer", async () => {
      arrange(sectionRow(), [entryRow(1, "Nasi Uduk")]);
      spies.insertValues.mockRejectedValueOnce(new Error("neon timeout"));

      await expect(syncSection(ORG, SECTION_ID)).rejects.toThrow(
        "neon timeout",
      );

      // The failure happened before the status update, so nothing was marked synced
      expect(spies.updateSet).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });
});
