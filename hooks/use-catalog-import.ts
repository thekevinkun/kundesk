"use client";

// State and handlers behind the catalog import dialog.
// The dialog is mounted only while open, so all state below starts fresh every time — no reset effect.
// The real work happens in the tested runners and helpers; this hook only wires them to React state.

import { useRef, useState } from "react";
import {
  extractCatalogFromText,
  importCatalogRows,
} from "@/lib/actions/knowledge-import";
import { normalizeTitleKey } from "@/helpers/knowledge-import";
import {
  clearSelection,
  getConfirmState,
  refreshFlags,
  removeRow,
  selectAllSafe,
  updateRow,
} from "@/helpers/knowledge-import-draft";
import { runExtraction, runSave } from "@/helpers/knowledge-import-runner";
import { MAX_IMPORT_INPUT_CHARS } from "@/types/knowledge";
import type {
  DraftPatch,
  DraftRow,
  ImportProgressState,
  ImportStep,
  ImportTotals,
} from "@/types/knowledge-import";

interface UseCatalogImportOptions {
  sectionId: number;
  existingTitles: string[]; // entries already in the section — used to flag duplicates
  initialRemainingSlots: number;
  onImported: () => void; // refresh the section list behind the dialog
  onClose: () => void;
}

const EMPTY_TOTALS: ImportTotals = {
  saved: 0,
  skippedDuplicates: 0,
  anyStale: false,
};

export function useCatalogImport({
  sectionId,
  existingTitles,
  initialRemainingSlots,
  onImported,
  onClose,
}: UseCatalogImportOptions) {
  const [step, setStep] = useState<ImportStep>("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [remainingSlots, setRemainingSlots] = useState(initialRemainingSlots);
  const [truncated, setTruncated] = useState(false);
  const [progress, setProgress] = useState<ImportProgressState>({
    done: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<ImportTotals>(EMPTY_TOTALS);
  // Titles saved during THIS dialog — they exist in the DB now, before the section list refreshes
  const [savedTitles, setSavedTitles] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const existingKeys: ReadonlySet<string> = new Set(
    [...existingTitles, ...savedTitles].map(normalizeTitleKey),
  );
  const confirm = getConfirmState(rows, remainingSlots);
  const overLimit = text.length > MAX_IMPORT_INPUT_CHARS;

  const changeText = (value: string) => {
    setText(value);
    setError(null);
  };

  // ── Step 1 → 2: read the pasted text ──
  const handleRead = async () => {
    if (!text.trim() || overLimit) return;

    setError(null);
    setProgress({ done: 0, total: 0 });
    setStep("reading");

    const controller = new AbortController();
    abortRef.current = controller;

    const outcome = await runExtraction({
      sectionId,
      text,
      extract: extractCatalogFromText,
      existingKeys,
      onProgress: (done, total) => setProgress({ done, total }),
      signal: controller.signal,
    });

    // Cancelled or closed while reading — the cancel handler already moved the screen
    if (controller.signal.aborted) return;

    if (outcome.drafts.length === 0) {
      setError(
        outcome.error ??
          "Tidak ada item yang bisa dibaca. Tulis satu item per baris, lengkap dengan harganya.",
      );
      setStep("paste");
      return;
    }

    setRows(outcome.drafts);
    setRemainingSlots(outcome.remainingSlots ?? remainingSlots);
    setTruncated(outcome.truncated);
    setError(
      outcome.error ? `Sebagian teks belum terbaca. ${outcome.error}` : null,
    );
    setStep("review");
  };

  const handleCancelReading = () => {
    abortRef.current?.abort();
    setStep("paste");
  };

  // ── Review edits — every change goes through the tested helpers ──
  const changeRow = (editorId: string, patch: DraftPatch) =>
    setRows((prev) => updateRow(prev, editorId, patch, existingKeys));
  const deleteRow = (editorId: string) =>
    setRows((prev) => removeRow(prev, editorId, existingKeys));
  const selectSafe = () => setRows((prev) => selectAllSafe(prev));
  const clearAll = () => setRows((prev) => clearSelection(prev));

  // ── Step 3 → 4: save the reviewed rows ──
  const handleConfirm = async () => {
    if (!confirm.canConfirm) return;

    setError(null);
    setProgress({ done: 0, total: 0 });
    setStep("saving");

    const toSave = rows;
    const controller = new AbortController();
    abortRef.current = controller;

    // The dialog cannot be closed while saving, so this signal is never aborted in practice
    const outcome = await runSave({
      sectionId,
      rows: toSave,
      save: importCatalogRows,
      onProgress: (done, total) => setProgress({ done, total }),
      signal: controller.signal,
    });

    // Rows that were saved (or skipped as duplicates) leave the list; the rest stay for a retry
    const processed = new Set(outcome.processedIds);
    const newTitles = toSave
      .filter((row) => processed.has(row.editorId))
      .map((row) => row.title);
    const nextKeys = new Set([
      ...existingKeys,
      ...newTitles.map(normalizeTitleKey),
    ]);

    setSavedTitles((prev) => [...prev, ...newTitles]);
    setRows(
      refreshFlags(
        toSave.filter((row) => !processed.has(row.editorId)),
        nextKeys,
      ),
    );
    setTotals((prev) => ({
      saved: prev.saved + outcome.saved,
      skippedDuplicates: prev.skippedDuplicates + outcome.skippedDuplicates,
      anyStale: prev.anyStale || outcome.anyStale,
    }));
    if (outcome.remainingSlots !== null) {
      setRemainingSlots(outcome.remainingSlots);
    }
    if (outcome.processedIds.length > 0) onImported();

    if (outcome.error) {
      setError(
        outcome.saved > 0
          ? `${outcome.saved} item sudah tersimpan. ${outcome.error}`
          : outcome.error,
      );
      setStep("review");
      return;
    }

    setStep("result");
  };

  // Closing is blocked while a save is running — the batch in flight cannot be cancelled
  const requestClose = () => {
    if (step === "saving") return;
    abortRef.current?.abort();
    onClose();
  };

  return {
    step,
    text,
    changeText,
    rows,
    remainingSlots,
    truncated,
    progress,
    error,
    totals,
    confirm,
    overLimit,
    handleRead,
    handleCancelReading,
    changeRow,
    deleteRow,
    selectSafe,
    clearAll,
    handleConfirm,
    requestClose,
  };
}
