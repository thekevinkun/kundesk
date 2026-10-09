"use client";

// Dialog shell for catalog import: paste → reading → review → saving → result.
// Mounted only while open (the panel renders it conditionally), so it always starts fresh.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ImportReview,
  ImportResultStep,
  ImportProgressStep,
  ImportPasteStep,
  ImportFooter,
} from "./";
import { useCatalogImport } from "@/hooks/use-catalog-import";
import type { KnowledgeSectionRow } from "@/types/knowledge";
import type { ImportStep } from "@/types/knowledge-import";

interface ImportDialogProps {
  section: KnowledgeSectionRow;
  remainingSlots: number;
  onClose: () => void;
  onImported: () => void;
}

const DESCRIPTIONS: Record<ImportStep, string> = {
  paste:
    "Tempel daftar item dari WhatsApp, Excel, atau catatan. KUN membacanya, lalu kamu cek dulu sebelum disimpan.",
  reading: "Sedang membaca teks kamu.",
  review: "Cek nama dan harga. Item yang ditandai perlu diperiksa dulu.",
  saving: "Sedang menyimpan item.",
  result: "Impor selesai.",
};

const ImportDialog = ({
  section,
  remainingSlots,
  onClose,
  onImported,
}: ImportDialogProps) => {
  const imp = useCatalogImport({
    sectionId: section.id,
    existingTitles: section.entries.map((entry) => entry.title),
    initialRemainingSlots: remainingSlots,
    onImported,
    onClose,
  });

  // A short paste is one round, so a counter would only confuse. "Tahap" rather than "bagian",
  // because "bagian" already means a section everywhere else in this app.
  const readingLabel =
    imp.progress.total > 1
      ? `Membaca teks (tahap ${Math.min(imp.progress.done + 1, imp.progress.total)} dari ${imp.progress.total})`
      : "Membaca teks...";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) imp.requestClose();
      }}
    >
      <DialogContent className="max-w-[440px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Impor ke {section.title}</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[imp.step]}</DialogDescription>
        </DialogHeader>

        {imp.step === "paste" && (
          <ImportPasteStep
            text={imp.text}
            onTextChange={imp.changeText}
            overLimit={imp.overLimit}
            error={imp.error}
          />
        )}

        {imp.step === "reading" && (
          <ImportProgressStep
            label={readingLabel}
            done={imp.progress.done}
            total={imp.progress.total}
          />
        )}

        {imp.step === "review" && (
          <div className="space-y-3">
            {imp.error && (
              <p role="alert" className="text-[12.5px] text-(--color-danger)">
                {imp.error}
              </p>
            )}
            <ImportReview
              rows={imp.rows}
              remainingSlots={imp.remainingSlots}
              confirm={imp.confirm}
              truncated={imp.truncated}
              disabled={false}
              onChangeRow={imp.changeRow}
              onRemoveRow={imp.deleteRow}
              onSelectAllSafe={imp.selectSafe}
              onClearSelection={imp.clearAll}
            />
            {imp.confirm.reason && (
              <p
                aria-live="polite"
                className="text-[12px] text-(--color-text-500)"
              >
                {imp.confirm.reason}
              </p>
            )}
          </div>
        )}

        {imp.step === "saving" && (
          <ImportProgressStep
            label={`Menyimpan ${imp.progress.done} dari ${imp.progress.total} item`}
            done={imp.progress.done}
            total={imp.progress.total}
          />
        )}

        {imp.step === "result" && (
          <ImportResultStep
            saved={imp.totals.saved}
            skippedDuplicates={imp.totals.skippedDuplicates}
            leftOver={imp.rows.length}
            anyStale={imp.totals.anyStale}
          />
        )}

        <ImportFooter
          step={imp.step}
          canRead={imp.text.trim().length > 0 && !imp.overLimit}
          confirm={imp.confirm}
          onRead={imp.handleRead}
          onCancelReading={imp.handleCancelReading}
          onConfirm={imp.handleConfirm}
          onClose={imp.requestClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ImportDialog;
