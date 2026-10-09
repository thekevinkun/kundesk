"use client";

// The dialog's buttons for each step. Saving has none — closing is blocked while it runs.

import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConfirmState, ImportStep } from "@/types/knowledge-import";

interface ImportFooterProps {
  step: ImportStep;
  canRead: boolean;
  confirm: ConfirmState;
  onRead: () => void;
  onCancelReading: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

// Same look as the cancel button in EntryDialog
const CANCEL_CLASS =
  "shrink-0 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all " +
  "dark:text-red-400 dark:border-red-900 dark:hover:bg-red-600 dark:hover:text-white";

const ImportFooter = ({
  step,
  canRead,
  confirm,
  onRead,
  onCancelReading,
  onConfirm,
  onClose,
}: ImportFooterProps) => {
  if (step === "saving") return null;

  return (
    <DialogFooter className="gap-2">
      {step === "paste" && (
        <>
          <Button variant="outline" onClick={onClose} className={CANCEL_CLASS}>
            Batal
          </Button>
          <Button onClick={onRead} disabled={!canRead} className="btn-brand">
            Baca teks
          </Button>
        </>
      )}

      {step === "reading" && (
        <Button
          variant="outline"
          onClick={onCancelReading}
          className={CANCEL_CLASS}
        >
          Batalkan
        </Button>
      )}

      {step === "review" && (
        <>
          <Button variant="outline" onClick={onClose} className={CANCEL_CLASS}>
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!confirm.canConfirm}
            className="btn-brand"
          >
            {confirm.selectedCount > 0
              ? `Simpan ${confirm.selectedCount} item`
              : "Simpan"}
          </Button>
        </>
      )}

      {step === "result" && (
        <Button onClick={onClose} className="btn-brand">
          Selesai
        </Button>
      )}
    </DialogFooter>
  );
};

export default ImportFooter;
