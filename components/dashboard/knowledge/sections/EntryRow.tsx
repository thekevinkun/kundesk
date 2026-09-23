"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { formatEntryPrice } from "@/helpers/knowledge";
import { setEntryAvailability } from "@/lib/actions/knowledge";
import { availabilityLabel } from "./constants";
import type { KnowledgeEntryRow, SectionKind } from "@/types/knowledge";

interface EntryRowProps {
  entry: KnowledgeEntryRow;
  sectionKind: SectionKind;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggled: () => void;
}

const EntryRow = ({
  entry,
  sectionKind,
  isAdmin,
  onEdit,
  onDelete,
  onToggled,
}: EntryRowProps) => {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      const result = await setEntryAvailability({
        id: entry.id,
        isAvailable: checked,
      });
      if (result.success) {
        onToggled();
        return;
      }
      toast.error("Gagal mengubah status", { description: result.error });
    });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-(--color-border-sm) last:border-0 hover:bg-(--color-bg-page) transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-(--color-text-900) truncate">
          {entry.title}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {entry.price && (
            <span className="text-[11.5px] text-(--color-text-400)">
              {formatEntryPrice(entry.price, true)}
            </span>
          )}
          {entry.syncStatus === "stale" && (
            <span className="badge-base badge-warning text-[10.5px]">
              Menunggu sinkronisasi
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Switch
          checked={entry.isAvailable}
          onCheckedChange={handleToggle}
          disabled={!isAdmin || isPending}
          aria-label={availabilityLabel(sectionKind, entry.isAvailable)}
        />
        <span className="text-[11px] text-(--color-text-400) w-14">
          {availabilityLabel(sectionKind, entry.isAvailable)}
        </span>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            aria-label={`Edit ${entry.title}`}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[13px] transition-all hover:bg-(--color-bg-page)"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            aria-label={`Hapus ${entry.title}`}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[13px] transition-all hover:bg-(--color-danger-bg) hover:text-(--color-danger)"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
};

export default EntryRow;
