"use client";

// Top-level list of named schedules — a business can have several
// (Rumah Paco: Klinik / Pet Shop / Darurat, each with its own days/hours)

import { Button } from "@/components/ui/button";
import HoursScheduleBlock from "./HoursScheduleBlock";
import { newEditorId } from "@/helpers/editor-id";
import type { EditableHoursSchedule } from "@/types/knowledge-editor";

interface HoursEditorProps {
  hours: EditableHoursSchedule[];
  onChange: (next: EditableHoursSchedule[]) => void;
  disabled: boolean;
}

const MAX_SCHEDULES = 8; // matches saveProfileSchema.hours array max

const HoursEditor = ({ hours, onChange, disabled }: HoursEditorProps) => {
  const update = (index: number, schedule: EditableHoursSchedule) => {
    onChange(hours.map((s, i) => (i === index ? schedule : s)));
  };

  const remove = (index: number) => {
    onChange(hours.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([
      ...hours,
      {
        editorId: newEditorId(),
        label: "",
        lines: [
          {
            editorId: newEditorId(),
            days: [],
            opens: "08:00",
            closes: "17:00",
          },
        ],
      },
    ]);
  };

  return (
    <div className="space-y-3">
      {hours.map((schedule, index) => (
        <HoursScheduleBlock
          key={schedule.editorId}
          schedule={schedule}
          onChange={(next) => update(index, next)}
          onRemove={() => remove(index)}
          disabled={disabled}
        />
      ))}

      {!disabled && hours.length < MAX_SCHEDULES && (
        <Button
          type="button"
          variant="outline"
          onClick={add}
          className="border-(--color-border) text-[12.5px]"
        >
          + Tambah jadwal
        </Button>
      )}

      {hours.length === 0 && disabled && (
        <p className="text-[12.5px] text-(--color-text-400)">
          Belum ada jam operasional.
        </p>
      )}
    </div>
  );
};

export default HoursEditor;
