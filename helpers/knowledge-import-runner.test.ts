import { describe, expect, it, vi } from "vitest";
import { normalizeTitleKey } from "@/helpers/knowledge-import";
import { runExtraction, runSave } from "@/helpers/knowledge-import-runner";
import { MAX_IMPORT_SAVE_ROWS, MAX_IMPORT_TOTAL_ROWS } from "@/types/knowledge";
import type { ActionResult } from "@/types/api";
import type {
  ExtractResult,
  ImportRow,
  ImportSaveData,
  ReviewRow,
} from "@/types/knowledge";
import type { DraftRow, ExtractFn, SaveFn } from "@/types/knowledge-import";

const clean = { injection: false, suspiciousPrice: false, duplicate: false };

const review = (title: string): ReviewRow => ({
  title,
  description: "",
  price: { mode: "fixed", amount: 25_000 },
  flags: clean,
});

const manyReviews = (count: number, prefix: string): ReviewRow[] =>
  Array.from({ length: count }, (_, i) => review(`${prefix}${i + 1}`));

const draft = (title: string, overrides: Partial<DraftRow> = {}): DraftRow => ({
  editorId: `id-${title}`,
  title,
  description: "",
  price: { mode: "fixed", amount: 25_000 },
  selected: true,
  flags: clean,
  ...overrides,
});

const manyDrafts = (count: number): DraftRow[] =>
  Array.from({ length: count }, (_, i) => draft(`Item ${i + 1}`));

const extractOk = (
  rows: ReviewRow[],
  remainingSlots = 100,
): ActionResult<ExtractResult> => ({
  success: true,
  data: { rows, remainingSlots },
});

const saveOk = (
  rows: ImportRow[],
  overrides: Partial<ImportSaveData> = {},
): ActionResult<ImportSaveData> => ({
  success: true,
  data: {
    saved: rows.length,
    skippedDuplicates: 0,
    syncStatus: "synced",
    remainingSlots: 7,
    ...overrides,
  },
});

const noKeys = new Set<string>();

// 31 non-empty lines = two extraction batches (30 + 1)
const twoBatchText = Array.from(
  { length: 31 },
  (_, i) => `Item ${i + 1} 10k`,
).join("\n");

describe("runExtraction", () => {
  it("does nothing for empty text", async () => {
    const extract = vi.fn(async (): ReturnType<ExtractFn> => extractOk([]));

    const outcome = await runExtraction({
      sectionId: 5,
      text: "  \n ",
      extract,
      existingKeys: noKeys,
    });

    expect(extract).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      drafts: [],
      remainingSlots: null,
      error: null,
      truncated: false,
      batchesDone: 0,
      batchesTotal: 0,
    });
  });

  it("calls the extraction once per batch with the section id", async () => {
    const extract = vi.fn(
      async (_input: Parameters<ExtractFn>[0]): ReturnType<ExtractFn> =>
        extractOk([review("X")]),
    );

    await runExtraction({
      sectionId: 5,
      text: twoBatchText,
      extract,
      existingKeys: noKeys,
    });

    expect(extract).toHaveBeenCalledTimes(2);
    expect(extract.mock.calls[0]?.[0].sectionId).toBe(5);
    expect(extract.mock.calls[0]?.[0].text.split("\n")).toHaveLength(30);
    expect(extract.mock.calls[1]?.[0].text).toBe("Item 31 10k");
  });

  it("accumulates rows, catches repeats across batches, and keeps the latest slot count", async () => {
    const extract = vi
      .fn(
        async (_input: Parameters<ExtractFn>[0]): ReturnType<ExtractFn> =>
          extractOk([]),
      )
      .mockResolvedValueOnce(extractOk([review("Es Teh")], 50))
      .mockResolvedValueOnce(extractOk([review("es teh")], 49));

    const outcome = await runExtraction({
      sectionId: 5,
      text: twoBatchText,
      extract,
      existingKeys: noKeys,
    });

    expect(outcome.drafts.map((d) => d.title)).toEqual(["Es Teh", "es teh"]);
    expect(outcome.drafts[1]?.flags.duplicate).toBe(true);
    expect(outcome.drafts[1]?.selected).toBe(false);
    expect(outcome.remainingSlots).toBe(49);
    expect(outcome.error).toBeNull();
  });

  it("flags names that already exist in the section", async () => {
    const extract = vi.fn(
      async (): ReturnType<ExtractFn> => extractOk([review("Nasi Goreng")]),
    );

    const outcome = await runExtraction({
      sectionId: 5,
      text: "Nasi Goreng 25k",
      extract,
      existingKeys: new Set([normalizeTitleKey("nasi goreng")]),
    });

    expect(outcome.drafts[0]?.flags.duplicate).toBe(true);
  });

  it("reports progress as batches finish", async () => {
    const extract = vi.fn(async (): ReturnType<ExtractFn> => extractOk([]));
    const onProgress = vi.fn();

    await runExtraction({
      sectionId: 5,
      text: twoBatchText,
      extract,
      existingKeys: noKeys,
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it("stops at the first failure and keeps the rows from earlier batches", async () => {
    const extract = vi
      .fn(
        async (_input: Parameters<ExtractFn>[0]): ReturnType<ExtractFn> =>
          extractOk([]),
      )
      .mockResolvedValueOnce(extractOk([review("Nasi Goreng")]))
      .mockResolvedValueOnce({
        success: false,
        error: "Terlalu banyak impor. Coba lagi dalam beberapa saat.",
      });

    const outcome = await runExtraction({
      sectionId: 5,
      text: twoBatchText,
      extract,
      existingKeys: noKeys,
    });

    expect(outcome.drafts.map((d) => d.title)).toEqual(["Nasi Goreng"]);
    expect(outcome.error).toBe(
      "Terlalu banyak impor. Coba lagi dalam beberapa saat.",
    );
    expect(outcome.batchesDone).toBe(1);
    expect(outcome.batchesTotal).toBe(2);
  });

  it("turns a thrown action into a generic message, never the raw error", async () => {
    const extract = vi.fn(async (): ReturnType<ExtractFn> => {
      throw new Error("fetch failed: secret internals");
    });

    const outcome = await runExtraction({
      sectionId: 5,
      text: "Nasi Goreng 25k",
      extract,
      existingKeys: noKeys,
    });

    expect(outcome.error).toBe(
      "Gagal membaca teks. Periksa koneksi lalu coba lagi.",
    );
    expect(outcome.drafts).toEqual([]);
  });

  it("does nothing when already aborted", async () => {
    const extract = vi.fn(async (): ReturnType<ExtractFn> => extractOk([]));
    const controller = new AbortController();
    controller.abort();

    const outcome = await runExtraction({
      sectionId: 5,
      text: twoBatchText,
      extract,
      existingKeys: noKeys,
      signal: controller.signal,
    });

    expect(extract).not.toHaveBeenCalled();
    expect(outcome.drafts).toEqual([]);
    expect(outcome.error).toBeNull();
  });

  it("cuts the result at the total row cap and says so", async () => {
    const extract = vi
      .fn(
        async (_input: Parameters<ExtractFn>[0]): ReturnType<ExtractFn> =>
          extractOk([]),
      )
      .mockResolvedValueOnce(extractOk(manyReviews(150, "A")))
      .mockResolvedValueOnce(extractOk(manyReviews(150, "B")));

    const outcome = await runExtraction({
      sectionId: 5,
      text: twoBatchText,
      extract,
      existingKeys: noKeys,
    });

    expect(outcome.drafts).toHaveLength(MAX_IMPORT_TOTAL_ROWS);
    expect(outcome.truncated).toBe(true);
    expect(outcome.drafts[MAX_IMPORT_TOTAL_ROWS - 1]?.title).toBe("B50");
  });

  it("stops reading further batches once the cap is reached", async () => {
    const extract = vi.fn(
      async (): ReturnType<ExtractFn> =>
        extractOk(manyReviews(MAX_IMPORT_TOTAL_ROWS, "A")),
    );

    const outcome = await runExtraction({
      sectionId: 5,
      text: twoBatchText,
      extract,
      existingKeys: noKeys,
    });

    expect(extract).toHaveBeenCalledTimes(1);
    expect(outcome.truncated).toBe(true);
    expect(outcome.batchesDone).toBe(1);
  });
});

describe("runSave", () => {
  it("sends the selected rows in batches of the per-call maximum, in order", async () => {
    const save = vi.fn(
      async (input: Parameters<SaveFn>[0]): ReturnType<SaveFn> =>
        saveOk(input.rows),
    );

    const outcome = await runSave({ sectionId: 5, rows: manyDrafts(30), save });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]?.[0].sectionId).toBe(5);
    expect(save.mock.calls[0]?.[0].rows).toHaveLength(MAX_IMPORT_SAVE_ROWS);
    expect(save.mock.calls[1]?.[0].rows).toHaveLength(
      30 - MAX_IMPORT_SAVE_ROWS,
    );
    expect(outcome.saved).toBe(30);
    expect(outcome.processedIds).toHaveLength(30);
    expect(outcome.error).toBeNull();
    expect(outcome.anyStale).toBe(false);
  });

  it("does not call the server when nothing is selected", async () => {
    const save = vi.fn(async (): ReturnType<SaveFn> => saveOk([]));

    const outcome = await runSave({
      sectionId: 5,
      rows: [draft("A", { selected: false })],
      save,
    });

    expect(save).not.toHaveBeenCalled();
    expect(outcome.processedIds).toEqual([]);
  });

  it("counts skipped duplicates and treats those rows as processed", async () => {
    const save = vi.fn(
      async (input: Parameters<SaveFn>[0]): ReturnType<SaveFn> =>
        saveOk(input.rows, { saved: 1, skippedDuplicates: 1 }),
    );

    const outcome = await runSave({
      sectionId: 5,
      rows: [draft("A"), draft("B")],
      save,
    });

    expect(outcome.saved).toBe(1);
    expect(outcome.skippedDuplicates).toBe(1);
    expect(outcome.processedIds).toEqual(["id-A", "id-B"]);
  });

  it("reports when any batch was saved but not yet embedded", async () => {
    const save = vi
      .fn(
        async (input: Parameters<SaveFn>[0]): ReturnType<SaveFn> =>
          saveOk(input.rows),
      )
      .mockResolvedValueOnce(saveOk([], { saved: 25, syncStatus: "stale" }));

    const outcome = await runSave({ sectionId: 5, rows: manyDrafts(30), save });

    expect(outcome.anyStale).toBe(true);
    expect(outcome.saved).toBe(30);
  });

  it("keeps the latest remaining-slot count", async () => {
    const save = vi
      .fn(
        async (input: Parameters<SaveFn>[0]): ReturnType<SaveFn> =>
          saveOk(input.rows),
      )
      .mockResolvedValueOnce(saveOk([], { saved: 25, remainingSlots: 20 }))
      .mockResolvedValueOnce(saveOk([], { saved: 5, remainingSlots: 15 }));

    const outcome = await runSave({ sectionId: 5, rows: manyDrafts(30), save });

    expect(outcome.remainingSlots).toBe(15);
  });

  it("stops at the first failure; rows from earlier batches count as processed, the rest stay", async () => {
    const message =
      "Slot entri tidak cukup — tersisa 3, sedangkan 5 item akan disimpan.";
    const save = vi
      .fn(
        async (input: Parameters<SaveFn>[0]): ReturnType<SaveFn> =>
          saveOk(input.rows),
      )
      .mockResolvedValueOnce(saveOk([], { saved: 25 }))
      .mockResolvedValueOnce({ success: false, error: message });

    const outcome = await runSave({ sectionId: 5, rows: manyDrafts(30), save });

    expect(save).toHaveBeenCalledTimes(2);
    expect(outcome.error).toBe(message);
    expect(outcome.saved).toBe(25);
    expect(outcome.processedIds).toHaveLength(25);
    expect(outcome.processedIds).not.toContain("id-Item 26");
  });

  it("turns a thrown action into a generic message, never the raw error", async () => {
    const save = vi.fn(async (): ReturnType<SaveFn> => {
      throw new Error("fetch failed: secret internals");
    });

    const outcome = await runSave({ sectionId: 5, rows: manyDrafts(3), save });

    expect(outcome.error).toBe(
      "Gagal menyimpan. Periksa koneksi lalu coba lagi.",
    );
    expect(outcome.processedIds).toEqual([]);
  });

  it("reports progress in rows", async () => {
    const save = vi.fn(
      async (input: Parameters<SaveFn>[0]): ReturnType<SaveFn> =>
        saveOk(input.rows),
    );
    const onProgress = vi.fn();

    await runSave({ sectionId: 5, rows: manyDrafts(30), save, onProgress });

    expect(onProgress.mock.calls).toEqual([
      [0, 30],
      [25, 30],
      [30, 30],
    ]);
  });

  it("stops before the next batch when aborted mid-way", async () => {
    const controller = new AbortController();
    const save = vi.fn(
      async (input: Parameters<SaveFn>[0]): ReturnType<SaveFn> => {
        controller.abort();
        return saveOk(input.rows);
      },
    );

    const outcome = await runSave({
      sectionId: 5,
      rows: manyDrafts(30),
      save,
      signal: controller.signal,
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(outcome.processedIds).toHaveLength(25);
    expect(outcome.error).toBeNull();
  });
});
