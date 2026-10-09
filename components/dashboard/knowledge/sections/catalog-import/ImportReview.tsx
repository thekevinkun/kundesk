"use client";

// The review list: a summary line, two bulk buttons, and the rows.
// Confirm and its explanation live in the dialog footer — this component never saves anything.

import { Button } from "@/components/ui/button";
import ImportReviewRow from "./ImportReviewRow";
import { MAX_IMPORT_TOTAL_ROWS } from "@/types/knowledge";
import type {
  ConfirmState,
  DraftPatch,
  DraftRow,
} from "@/types/knowledge-import";

interface ImportReviewProps {
  rows: DraftRow[];
  remainingSlots: number;
  confirm: ConfirmState;
  truncated: boolean;
  disabled: boolean;
  onChangeRow: (editorId: string, patch: DraftPatch) => void;
  onRemoveRow: (editorId: string) => void;
  onSelectAllSafe: () => void;
  onClearSelection: () => void;
}

const ImportReview = ({
  rows,
  remainingSlots,
  confirm,
  truncated,
  disabled,
  onChangeRow,
  onRemoveRow,
  onSelectAllSafe,
  onClearSelection,
}: ImportReviewProps) => {
  const needsCheck = rows.filter(
    (row) =>
      row.flags.injection || row.flags.duplicate || row.flags.suspiciousPrice,
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* aria-live so a screen reader hears the count change as rows are ticked */}
        <div
          aria-live="polite"
          className="text-[12.5px] text-(--color-text-700)"
        >
          <span className="font-semibold">{confirm.selectedCount}</span> dari{" "}
          {rows.length} item dipilih. Sisa slot entri: {remainingSlots}.
          {needsCheck > 0 && (
            <span className="block text-[11.5px] text-(--color-text-500)">
              {needsCheck} item perlu diperiksa.
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSelectAllSafe}
            disabled={disabled}
            className="btn-outline text-[12px]"
          >
            Pilih semua yang aman
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClearSelection}
            disabled={disabled}
            className="btn-outline text-[12px]"
          >
            Hapus pilihan
          </Button>
        </div>
      </div>

      {truncated && (
        <p className="text-[12px] text-(--color-text-500)">
          Hanya {MAX_IMPORT_TOTAL_ROWS} item pertama yang ditampilkan. Impor
          sisanya setelah ini selesai.
        </p>
      )}

      <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {rows.map((row) => (
          <ImportReviewRow
            key={row.editorId}
            row={row}
            disabled={disabled}
            onChange={(patch) => onChangeRow(row.editorId, patch)}
            onRemove={() => onRemoveRow(row.editorId)}
          />
        ))}
      </ul>
    </div>
  );
};

export default ImportReview;
