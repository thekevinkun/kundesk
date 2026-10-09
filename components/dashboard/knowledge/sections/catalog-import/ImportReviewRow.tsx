"use client";

// One row of the import review screen: tick box, name, optional description, price, warnings.
// All state lives in the dialog — this component only draws the row and reports edits upward.

import { Input } from "@/components/ui/input";
import ImportPriceEditor from "./ImportPriceEditor";
import { getRowError } from "@/helpers/knowledge-import-draft";
import { cn } from "@/lib/utils";
import { MAX_IMPORT_DESCRIPTION_CHARS } from "@/types/knowledge";
import type { DraftPatch, DraftRow } from "@/types/knowledge-import";

interface ImportReviewRowProps {
  row: DraftRow;
  disabled: boolean;
  onChange: (patch: DraftPatch) => void;
  onRemove: () => void;
}

const ImportReviewRow = ({
  row,
  disabled,
  onChange,
  onRemove,
}: ImportReviewRowProps) => {
  const error = getRowError(row);
  // Only a SELECTED row with an error blocks saving — an unselected one is just skipped
  const blocking = row.selected && error !== null;
  const itemName = row.title || "item ini";

  return (
    <li
      className={cn(
        "card-base p-3",
        blocking && "border-(--color-danger)",
        !row.selected && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Native checkbox — no shadcn Checkbox is installed in this project */}
        <input
          type="checkbox"
          checked={row.selected}
          onChange={(e) => onChange({ selected: e.target.checked })}
          disabled={disabled}
          aria-label={`Simpan ${itemName}`}
          className="mt-2.5 h-4 w-4 flex-shrink-0 accent-(--color-brand)"
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={row.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Nama item"
              maxLength={120}
              disabled={disabled}
              className="input-base"
              aria-label="Nama item"
            />
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={`Hapus ${itemName} dari daftar`}
              className="text-(--color-text-400) hover:text-(--color-danger) transition-colors px-2 py-2 leading-none"
            >
              ×
            </button>
          </div>

          <Input
            value={row.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Deskripsi (opsional)"
            maxLength={MAX_IMPORT_DESCRIPTION_CHARS}
            disabled={disabled}
            className="input-base"
            aria-label={`Deskripsi ${itemName}`}
          />

          <ImportPriceEditor
            price={row.price}
            onChange={(price) => onChange({ price })}
            disabled={disabled}
            itemName={itemName}
          />

          {(row.flags.injection ||
            row.flags.duplicate ||
            row.flags.suspiciousPrice) && (
            <div className="flex flex-wrap gap-1.5">
              {row.flags.injection && (
                <span className="badge-base badge-danger text-[10.5px]">
                  Teks mirip perintah untuk AI
                </span>
              )}
              {row.flags.duplicate && (
                <span className="badge-base badge-warning text-[10.5px]">
                  Nama sudah ada
                </span>
              )}
              {row.flags.suspiciousPrice && (
                <span className="badge-base badge-warning text-[10.5px]">
                  Cek harga
                </span>
              )}
            </div>
          )}

          {row.flags.injection && (
            <p className="text-[11.5px] text-(--color-text-500)">
              Periksa teks ini dulu. Centang hanya kalau memang bagian dari
              katalogmu.
            </p>
          )}
          {row.flags.duplicate && (
            <p className="text-[11.5px] text-(--color-text-500)">
              Nama ini sudah ada atau muncul lebih dulu di daftar, jadi dilewati
              saat disimpan.
            </p>
          )}

          {error && (
            <p
              className={cn(
                "text-[11.5px]",
                row.selected
                  ? "text-(--color-danger)"
                  : "text-(--color-text-400)",
              )}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
};

export default ImportReviewRow;
