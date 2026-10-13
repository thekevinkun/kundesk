"use client";

// Dialog shell for catalog import: first screen (paste text OR pick a photo) → reading → review →
// saving → result. Mounted only while open (the panel renders it conditionally), so it always starts fresh.

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
import ImportPhotoStep from "./ImportPhotoStep";
import ImportSourceSwitch from "./ImportSourceSwitch";
import { useCatalogImport } from "@/hooks/use-catalog-import";
import {
  getReadingLabel,
  getStepDescription,
} from "@/helpers/knowledge-import-labels";
import type { KnowledgeSectionRow } from "@/types/knowledge";

interface ImportDialogProps {
  section: KnowledgeSectionRow;
  remainingSlots: number;
  onClose: () => void;
  onImported: () => void;
}

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
          <DialogDescription>
            {getStepDescription(imp.step, imp.source)}
          </DialogDescription>
        </DialogHeader>

        {imp.step === "paste" && (
          <div className="space-y-3">
            <ImportSourceSwitch
              source={imp.source}
              onChange={imp.changeSource}
            />
            {imp.source === "text" ? (
              <ImportPasteStep
                text={imp.text}
                onTextChange={imp.changeText}
                overLimit={imp.overLimit}
                error={imp.error}
              />
            ) : (
              <ImportPhotoStep
                file={imp.file}
                onFileChange={imp.changeFile}
                error={imp.error}
              />
            )}
          </div>
        )}

        {imp.step === "reading" && (
          <ImportProgressStep
            label={getReadingLabel({
              source: imp.source,
              stage: imp.photoStage,
              progress: imp.progress,
            })}
            done={imp.progress.done}
            total={imp.progress.total}
            // A photo is one call — there is no real progress to show
            indeterminate={imp.source === "photo"}
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
              source={imp.source}
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
          source={imp.source}
          canRead={imp.canRead}
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
