"use client";

// Shared by the reading and saving steps: one line of text, a percentage and a bar.
// aria-live so a screen reader hears the progress without moving focus.
// The shadcn Progress colors itself with generic tokens (bg-primary) that this project does not
// define, so the track and fill colors are passed in explicitly. The "!" wins over the component's own classes.

import { Progress } from "@/components/ui/progress";

interface ImportProgressStepProps {
  label: string;
  done: number;
  total: number;
}

const ImportProgressStep = ({
  label,
  done,
  total,
}: ImportProgressStepProps) => {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-3 py-8" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-(--color-text-700)">{label}</p>
        <span className="text-[12px] font-semibold text-(--color-text-500)">
          {percent}%
        </span>
      </div>
      <Progress
        value={percent}
        className="!bg-(--color-brand-light) [&_[data-slot=progress-indicator]]:!bg-(--color-brand)"
      />
    </div>
  );
};

export default ImportProgressStep;
