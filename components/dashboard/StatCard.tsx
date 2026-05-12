import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Icon background color variants ──
const iconBgVariants = {
  brand: "bg-gradient-to-br from-(--color-brand-light) to-(--color-brand-mid)",
  teal: "bg-gradient-to-br from-emerald-100 to-emerald-200",
  amber: "bg-gradient-to-br from-amber-100 to-amber-200",
  rose: "bg-gradient-to-br from-rose-100 to-rose-200",
  blue: "bg-gradient-to-br from-blue-100 to-blue-200",
} as const;

type IconVariant = keyof typeof iconBgVariants;

// ── Change badge — green for up, red for down ──
const ChangeBadge = ({
  direction,
  label,
}: {
  direction: "up" | "down" | "neutral";
  label: string;
}) => {
  if (direction === "neutral") {
    return (
      <span className="badge-base bg-(--color-bg-page) text-(--color-text-400) border border-(--color-border)">
        {label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "badge-base",
        direction === "up" ? "badge-success" : "badge-danger",
      )}
    >
      {/* Arrow indicator */}
      <span className="text-[10px]">{direction === "up" ? "↑" : "↓"}</span>
      {label}
    </span>
  );
};

// ── StatCardSkeleton — exported for loading.tsx and Suspense ──
export const StatCardSkeleton = () => {
  return (
    <div className="card-base p-5 flex items-center gap-4">
      {/* Icon placeholder */}
      <Skeleton className="w-[52px] h-[52px] rounded-[14px] flex-shrink-0" />

      {/* Text placeholders */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-7 w-20 rounded-[8px]" />
        <Skeleton className="h-3.5 w-28 rounded-[6px]" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  );
};

// ── StatCard props ──
export interface StatCardProps {
  icon: string;
  iconVariant: IconVariant;
  value: string;
  label: string;
  changeDirection: "up" | "down" | "neutral";
  changeLabel: string;
}

// ── StatCard — the real card with data ──
const StatCard = ({
  icon,
  iconVariant,
  value,
  label,
  changeDirection,
  changeLabel,
}: StatCardProps) => {
  return (
    <div className="card-base card-hover p-5 flex items-center gap-4">
      {/* Icon with colored gradient background — Sedap style */}
      <div
        className={cn(
          "w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0",
          iconBgVariants[iconVariant],
        )}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Metric body */}
      <div className="flex-1 min-w-0">
        {/* Big number — tight tracking like the mockup */}
        <div className="text-[28px] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-none mb-1">
          {value}
        </div>
        <div className="text-[12px] text-(--color-text-500) font-medium mb-1.5">
          {label}
        </div>
        <ChangeBadge direction={changeDirection} label={changeLabel} />
      </div>
    </div>
  );
};

export default StatCard;
