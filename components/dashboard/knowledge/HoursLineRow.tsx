"use client";

// One line of a schedule — day picker + time range, e.g. "Senin–Jumat, 08:00–20:00"
// Day chips reuse the same pressable-button pattern as ChatbotConfigPage's
// color preset grid, instead of introducing a new checkbox-group primitive

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { EditableHoursLine } from "@/types/knowledge-editor";

interface HoursLineRowProps {
  line: EditableHoursLine;
  onChange: (next: EditableHoursLine) => void;
  onRemove: () => void;
  disabled: boolean;
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS: Record<number, string> = {
  0: "Min",
  1: "Sen",
  2: "Sel",
  3: "Rab",
  4: "Kam",
  5: "Jum",
  6: "Sab",
};

const HoursLineRow = ({
  line,
  onChange,
  onRemove,
  disabled,
}: HoursLineRowProps) => {
  const toggleDay = (day: number) => {
    const next = line.days.includes(day)
      ? line.days.filter((d) => d !== day)
      : [...line.days, day];
    onChange({ ...line, days: next });
  };

  // "24:00" isn't a valid native <input type="time"> value — handled as a
  // separate switch rather than forcing it through the time input
  const isMidnight = line.closes === "24:00";

  // Remembers the last real closing time so disabling "sampai tengah malam"
  // restores it instead of a hardcoded fallback (CodeRabbit finding — the
  // previous version always reset to 22:00, silently discarding whatever
  // the owner had actually set, e.g. 17:00, before enabling midnight)
  const [lastNonMidnightClose, setLastNonMidnightClose] = useState(
    line.closes === "24:00" ? "22:00" : line.closes,
  );

  useEffect(() => {
    if (line.closes !== "24:00") {
      setLastNonMidnightClose(line.closes);
    }
  }, [line.closes]);

  return (
    <div
      className="group rounded-(--radius-sm) border border-(--color-border-sm)
      p-3 space-y-2.5 transition-colors hover:border-(--color-brand-mid) hover:bg-(--color-bg-page)"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5 sm:flex sm:flex-none sm:flex-wrap">
          {WEEKDAY_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => toggleDay(day)}
              aria-pressed={line.days.includes(day)}
              className={cn(
                "w-full h-8 sm:w-9 rounded-[7px] text-[12px] font-semibold transition-colors",
                line.days.includes(day)
                  ? "bg-(--color-brand) text-white hover:bg-(--color-brand-dark)"
                  : "bg-(--color-bg-card) text-(--color-text-500) border border-(--color-border) hover:border-(--color-brand-mid) hover:bg-(--color-brand-light) hover:text-(--color-text-900)",
              )}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          ))}
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Hapus baris jam ini"
            className="rounded-full p-1.5 text-(--color-text-400) opacity-100 transition-opacity sm:opacity-0 group-hover:opacity-100
              group-focus-within:opacity-100 hover:bg-(--color-danger)/10 hover:text-(--color-danger)"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[120px] flex-1 sm:flex-none">
          <Label className="text-[11.5px] text-(--color-text-400) mb-1 block">
            Buka
          </Label>
          <Input
            type="time"
            value={line.opens}
            onChange={(e) => onChange({ ...line, opens: e.target.value })}
            disabled={disabled}
            className="input-base w-full sm:w-[150px] transition-all hover:border-brand hover:bg-brand/25"
          />
        </div>

        <div className="min-w-[120px] flex-1 sm:flex-none">
          <Label className="text-[11.5px] text-(--color-text-400) mb-1 block">
            Tutup
          </Label>
          <Input
            type="time"
            value={isMidnight ? "" : line.closes}
            onChange={(e) => onChange({ ...line, closes: e.target.value })}
            disabled={disabled || isMidnight}
            className="input-base w-full sm:w-[150px] transition-all hover:border-brand hover:bg-brand/25"
          />
        </div>

        <div className="flex w-full items-center gap-2 pt-1 sm:w-auto sm:pt-4">
          <Switch
            checked={isMidnight}
            onCheckedChange={(checked) =>
              onChange({
                ...line,
                closes: checked ? "24:00" : lastNonMidnightClose,
              })
            }
            disabled={disabled}
            aria-label="Sampai tengah malam"
          />
          <span className="text-[12px] text-(--color-text-500)">
            Sampai tengah malam
          </span>
        </div>
      </div>

      <Input
        value={line.note ?? ""}
        onChange={(e) =>
          onChange({ ...line, note: e.target.value || undefined })
        }
        placeholder="Catatan (opsional) — contoh: hanya untuk darurat"
        maxLength={100}
        disabled={disabled}
        className="input-base"
        aria-label="Catatan jam"
      />
    </div>
  );
};

export default HoursLineRow;
