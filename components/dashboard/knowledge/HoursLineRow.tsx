"use client";

// One line of a schedule — day picker + time range, e.g. "Senin–Jumat, 08:00–20:00"
// Day chips reuse the same pressable-button pattern as ChatbotConfigPage's
// color preset grid, instead of introducing a new checkbox-group primitive

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HoursLine } from "@/types/knowledge";

interface HoursLineRowProps {
  line: HoursLine;
  onChange: (next: HoursLine) => void;
  onRemove: () => void;
  disabled: boolean;
}

// Display order starts Monday even though stored days use 0=Minggu (JS getDay convention)
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

  return (
    <div className="rounded-(--radius-sm) border border-(--color-border-sm) p-3 space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_ORDER.map((day) => (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => toggleDay(day)}
            aria-pressed={line.days.includes(day)}
            className={cn(
              "w-9 h-8 rounded-[7px] text-[12px] font-semibold transition-colors",
              line.days.includes(day)
                ? "bg-(--color-brand) text-white"
                : "bg-(--color-bg-page) text-(--color-text-500) border border-(--color-border) hover:text-(--color-text-900)",
            )}
          >
            {WEEKDAY_LABELS[day]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <Label className="text-[11.5px] text-(--color-text-400) mb-1 block">
            Buka
          </Label>
          <Input
            type="time"
            value={line.opens}
            onChange={(e) => onChange({ ...line, opens: e.target.value })}
            disabled={disabled}
            className="input-base w-[110px]"
          />
        </div>

        <div>
          <Label className="text-[11.5px] text-(--color-text-400) mb-1 block">
            Tutup
          </Label>
          <Input
            type="time"
            value={isMidnight ? "" : line.closes}
            onChange={(e) => onChange({ ...line, closes: e.target.value })}
            disabled={disabled || isMidnight}
            className="input-base w-[110px]"
          />
        </div>

        <div className="flex items-center gap-2 pt-4">
          <Switch
            checked={isMidnight}
            onCheckedChange={(checked) =>
              onChange({ ...line, closes: checked ? "24:00" : "22:00" })
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

      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="text-[12px] text-(--color-text-400) hover:text-(--color-danger) transition-colors"
        >
          Hapus baris ini
        </button>
      )}
    </div>
  );
};

export default HoursLineRow;
