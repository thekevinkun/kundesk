"use client";

// One named schedule (e.g. "Klinik", "Pet Shop", "Darurat") — label, optional
// note, and its list of HoursLineRow entries

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import HoursLineRow from "./HoursLineRow";
import { newEditorId } from "@/helpers/editor-id";
import type { EditableHoursSchedule } from "@/types/knowledge-editor";

interface HoursScheduleBlockProps {
  schedule: EditableHoursSchedule;
  onChange: (next: EditableHoursSchedule) => void;
  onRemove: () => void;
  disabled: boolean;
}

const MAX_LINES = 14; // matches hoursScheduleSchema.lines array max

const HoursScheduleBlock = ({
  schedule,
  onChange,
  onRemove,
  disabled,
}: HoursScheduleBlockProps) => {
  const updateLine = (
    index: number,
    line: EditableHoursSchedule["lines"][number],
  ) => {
    onChange({
      ...schedule,
      lines: schedule.lines.map((l, i) => (i === index ? line : l)),
    });
  };

  const removeLine = (index: number) => {
    onChange({
      ...schedule,
      lines: schedule.lines.filter((_, i) => i !== index),
    });
  };

  const addLine = () => {
    onChange({
      ...schedule,
      lines: [
        ...schedule.lines,
        { editorId: newEditorId(), days: [], opens: "08:00", closes: "17:00" },
      ],
    });
  };

  return (
    <div className="rounded-(--radius-md) border border-(--color-border) p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Input
            value={schedule.label}
            onChange={(e) => onChange({ ...schedule, label: e.target.value })}
            placeholder="Nama jadwal — contoh: Klinik, Pet Shop, Darurat"
            maxLength={40}
            disabled={disabled}
            className="input-base font-semibold"
            aria-label="Nama jadwal"
          />
          <Input
            value={schedule.note ?? ""}
            onChange={(e) =>
              onChange({ ...schedule, note: e.target.value || undefined })
            }
            placeholder="Catatan jadwal (opsional)"
            maxLength={150}
            disabled={disabled}
            className="input-base"
            aria-label="Catatan jadwal"
          />
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Hapus jadwal ${schedule.label || ""}`}
            className="text-(--color-text-400) hover:text-(--color-danger) transition-colors px-1"
          >
            ×
          </button>
        )}
      </div>

      <Separator className="bg-(--color-border-sm)" />

      <div className="space-y-2.5">
        {schedule.lines.map((line, index) => (
          <HoursLineRow
            key={line.editorId}
            line={line}
            onChange={(next) => updateLine(index, next)}
            onRemove={() => removeLine(index)}
            disabled={disabled}
          />
        ))}
      </div>

      {!disabled && schedule.lines.length < MAX_LINES && (
        <Button
          type="button"
          variant="outline"
          onClick={addLine}
          className="border-(--color-border) text-[12px]"
        >
          + Tambah baris jam
        </Button>
      )}
    </div>
  );
};

export default HoursScheduleBlock;
