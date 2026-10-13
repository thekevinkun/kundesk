"use client";

// Two buttons at the top of step 1: where the items come from. A button group with aria-pressed,
// not tabs — there are no tab panels, just one screen that changes.

import { cn } from "@/lib/utils";
import type { ImportSource } from "@/types/knowledge-import";

interface ImportSourceSwitchProps {
  source: ImportSource;
  onChange: (source: ImportSource) => void;
}

const OPTIONS: ReadonlyArray<{ value: ImportSource; label: string }> = [
  { value: "text", label: "Tempel teks" },
  { value: "photo", label: "Foto" },
];

const ImportSourceSwitch = ({ source, onChange }: ImportSourceSwitchProps) => (
  <div
    role="group"
    aria-label="Sumber impor"
    className="flex gap-1 rounded-[10px] bg-(--color-bg-page) p-1"
  >
    {OPTIONS.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={source === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          "flex-1 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
          source === option.value
            ? "bg-(--color-bg-card) text-(--color-text-900) shadow-sm"
            : "text-(--color-text-500) hover:text-(--color-text-700)",
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default ImportSourceSwitch;
