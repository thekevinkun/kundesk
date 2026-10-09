// Pure logic behind the import review screen — no React, no network, fully unit testable.
// The dialog keeps a DraftRow[] and only ever changes it through these functions.

import { newEditorId } from "@/helpers/editor-id";
import {
  isSuspiciousPrice,
  normalizeTitleKey,
} from "@/helpers/knowledge-import";
import { importRowSchema } from "@/helpers/knowledge-schemas";
import { detectImportInjection } from "@/helpers/security";
import { MAX_IMPORT_SAVE_ROWS } from "@/types/knowledge";
import type { ImportRow, ReviewRow } from "@/types/knowledge";
import type {
  ConfirmState,
  DraftRow,
  SaveBatch,
} from "@/types/knowledge-import";

// Recomputes every row's warnings from its CURRENT values. Called after every change, so
// editing a title or price updates its warnings. A name counts as duplicate when it exists in the
// section already (existingKeys) or appears EARLIER in the list — the first occurrence is not a duplicate.
// Never changes `selected`.
export function refreshFlags(
  rows: DraftRow[],
  existingKeys: ReadonlySet<string>,
): DraftRow[] {
  const seen = new Set(existingKeys);

  return rows.map((row) => {
    const key = normalizeTitleKey(row.title);
    // An empty title is never a duplicate — it is an error, reported elsewhere
    const duplicate = key !== "" && seen.has(key);
    if (key !== "") seen.add(key);

    return {
      ...row,
      flags: {
        injection:
          detectImportInjection(row.title) ||
          detectImportInjection(row.description),
        suspiciousPrice: isSuspiciousPrice(row.price),
        duplicate,
      },
    };
  });
}

// Adds freshly extracted rows to the list. New rows start selected, EXCEPT duplicates and
// injection-looking rows — those need a deliberate tick. Existing rows keep their selection.
// Warnings are recomputed here for the whole list, so repeats across batches are caught too.
export function appendDrafts(
  current: DraftRow[],
  incoming: ReviewRow[],
  existingKeys: ReadonlySet<string>,
): DraftRow[] {
  const added: DraftRow[] = incoming.map((row) => ({
    editorId: newEditorId(),
    title: row.title,
    description: row.description,
    price: row.price,
    selected: true,
    flags: row.flags,
  }));
  const addedIds = new Set(added.map((row) => row.editorId));

  return refreshFlags([...current, ...added], existingKeys).map((row) =>
    addedIds.has(row.editorId)
      ? { ...row, selected: !(row.flags.injection || row.flags.duplicate) }
      : row,
  );
}

// Applies an owner edit to one row, then refreshes all warnings.
// A row that BECOMES injection-looking because of an edit is unselected again.
export function updateRow(
  rows: DraftRow[],
  editorId: string,
  patch: Partial<
    Pick<DraftRow, "title" | "description" | "price" | "selected">
  >,
  existingKeys: ReadonlySet<string>,
): DraftRow[] {
  const wasInjection = new Map(
    rows.map((row) => [row.editorId, row.flags.injection]),
  );
  const changed = rows.map((row) =>
    row.editorId === editorId ? { ...row, ...patch } : row,
  );

  return refreshFlags(changed, existingKeys).map((row) =>
    row.editorId === editorId &&
    !wasInjection.get(row.editorId) &&
    row.flags.injection
      ? { ...row, selected: false }
      : row,
  );
}

// Removes a row. Warnings are refreshed because a removed first occurrence un-duplicates the next one.
export function removeRow(
  rows: DraftRow[],
  editorId: string,
  existingKeys: ReadonlySet<string>,
): DraftRow[] {
  return refreshFlags(
    rows.filter((row) => row.editorId !== editorId),
    existingKeys,
  );
}

// "Pilih semua yang aman" — selects every row except duplicates and injection-looking ones,
// which stay unselected (they need a deliberate tick)
export function selectAllSafe(rows: DraftRow[]): DraftRow[] {
  return rows.map((row) => ({
    ...row,
    selected: !(row.flags.injection || row.flags.duplicate),
  }));
}

export function clearSelection(rows: DraftRow[]): DraftRow[] {
  return rows.map((row) => ({ ...row, selected: false }));
}

// The first problem with a row, in the wording the owner sees — or null when it can be saved.
// Uses the SAME schema the server re-validates with, so the screen can never accept a row the server refuses.
export function getRowError(
  row: Pick<DraftRow, "title" | "description" | "price">,
): string | null {
  if (row.price === null) return "Harga belum diisi";

  const parsed = importRowSchema.safeParse({
    title: row.title,
    description: row.description,
    price: row.price,
  });
  if (parsed.success) return null;

  return parsed.error.issues[0]?.message ?? "Data item tidak valid";
}

// Whether Confirm may be pressed. Only SELECTED rows count — an unselected row with an error is fine.
export function getConfirmState(
  rows: DraftRow[],
  remainingSlots: number,
): ConfirmState {
  const selected = rows.filter((row) => row.selected);
  const blockingRows = selected.filter(
    (row) => getRowError(row) !== null,
  ).length;
  const overSlots = selected.length > remainingSlots;

  let reason: string | null = null;
  if (selected.length === 0) {
    reason = "Pilih minimal satu item untuk disimpan.";
  } else if (blockingRows > 0) {
    reason = `${blockingRows} item perlu diperbaiki sebelum disimpan.`;
  } else if (overSlots) {
    reason = `Slot entri tidak cukup — tersisa ${remainingSlots}, dipilih ${selected.length}.`;
  }

  return {
    selectedCount: selected.length,
    blockingRows,
    overSlots,
    canConfirm: reason === null,
    reason,
  };
}

// Splits the selected rows into save calls of at most MAX_IMPORT_SAVE_ROWS.
// Unselected rows and rows without a price are skipped (Confirm blocks the second case anyway).
export function buildSaveBatches(rows: DraftRow[]): SaveBatch[] {
  const batches: SaveBatch[] = [];
  let current: SaveBatch = { editorIds: [], rows: [] };

  for (const row of rows) {
    if (!row.selected || row.price === null) continue;

    const importRow: ImportRow = {
      title: row.title,
      description: row.description,
      price: row.price,
    };
    current.editorIds.push(row.editorId);
    current.rows.push(importRow);

    if (current.rows.length === MAX_IMPORT_SAVE_ROWS) {
      batches.push(current);
      current = { editorIds: [], rows: [] };
    }
  }

  if (current.rows.length > 0) batches.push(current);
  return batches;
}
