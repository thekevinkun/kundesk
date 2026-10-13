"use client";

// Shared by the reading and saving steps: one line of text and a bar.
// Normal mode shows a percentage. Indeterminate mode (a photo read: one call, no real progress)
// shows a pulsing bar and NO percentage, so it never pretends to know how far along it is.
// aria-live so a screen reader hears the progress without moving focus.
// The shadcn Progress colors itself with generic tokens (bg-primary) that this project does not
// define, so the track and fill colors are passed in explicitly. The "!" wins over the component's own classes.

import { Progress } from "@/components/ui/progress";

interface ImportProgressStepProps {
  label: string;
  done: number;
  total: number;
  indeterminate?: boolean | undefined;
}

const ImportProgressStep = ({
  label,
  done,
  total,
  indeterminate = false,
}: ImportProgressStepProps) => {
  if (indeterminate) {
    return (
      <div className="space-y-3 py-8" aria-live="polite">
        <p className="text-[13px] text-(--color-text-700)">{label}</p>
        {/* No aria-valuenow on purpose — an indeterminate progressbar has no value */}
        <div
          role="progressbar"
          aria-label={label}
          className="h-2 w-full overflow-hidden rounded-full bg-(--color-brand-light)"
        >
          <div className="h-full w-1/3 animate-pulse rounded-full bg-(--color-brand)" />
        </div>
      </div>
    );
  }

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
