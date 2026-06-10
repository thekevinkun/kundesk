import type { CSSProperties } from "react";

const SkeletonBlock = ({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`skeleton rounded-[10px] ${className}`}
    style={style}
    aria-hidden="true"
  />
);

const SkeletonCard = ({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => <div className={`card-base p-6 ${className}`}>{children}</div>;

export default function AnalyticsLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat analytics">
      {/* Page header skeleton */}
      <div className="mb-6">
        <SkeletonBlock className="h-7 w-48 mb-2" />
        <SkeletonBlock className="h-4 w-72" />
      </div>

      <div className="space-y-5">
        {/* ── Row 1: KPI strip — 4 cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="flex items-center gap-4">
              {/* Icon block */}
              <SkeletonBlock className="w-12 h-12 rounded-[14px] flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-7 w-20" />
                <SkeletonBlock className="h-3.5 w-28" />
              </div>
            </SkeletonCard>
          ))}
        </div>

        {/* ── Row 2: Handoff insight (2/3) + Channel breakdown (1/3) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Handoff insight */}
          <SkeletonCard className="col-span-1 lg:col-span-2">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="space-y-2">
                <SkeletonBlock className="h-5 w-44" />
                <SkeletonBlock className="h-3.5 w-64" />
              </div>
              <SkeletonBlock className="h-7 w-28 rounded-full" />
            </div>
            {/* Donut + trend */}
            <div className="flex items-center gap-6 mb-5">
              <SkeletonBlock className="w-[120px] h-[120px] rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="flex gap-4">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="h-4 w-24" />
                </div>
                <SkeletonBlock className="h-3 w-32" />
                <SkeletonBlock className="h-[140px] w-full" />
              </div>
            </div>
            {/* Insight copy */}
            <SkeletonBlock className="h-16 w-full rounded-[10px]" />
          </SkeletonCard>

          {/* Channel breakdown */}
          <SkeletonCard>
            <div className="space-y-2 mb-5">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-3.5 w-44" />
            </div>
            <div className="flex items-center gap-6">
              <SkeletonBlock className="w-[120px] h-[120px] rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <SkeletonBlock className="h-3.5 w-24" />
                      <SkeletonBlock className="h-3.5 w-8" />
                    </div>
                    <SkeletonBlock className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </SkeletonCard>
        </div>

        {/* ── Row 3: Top questions + Peak hours ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Top questions */}
          <SkeletonCard>
            <div className="space-y-2 mb-5">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-3.5 w-56" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBlock
                  key={i}
                  className="h-10 w-full"
                  // Vary widths so it looks like real data
                  style={{ width: `${100 - i * 6}%` } as CSSProperties}
                />
              ))}
            </div>
          </SkeletonCard>

          {/* Peak hours */}
          <SkeletonCard>
            <div className="flex items-start justify-between mb-5">
              <div className="space-y-2">
                <SkeletonBlock className="h-5 w-32" />
                <SkeletonBlock className="h-3.5 w-52" />
              </div>
              <div className="space-y-1 text-right">
                <SkeletonBlock className="h-6 w-16" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
            </div>
            <SkeletonBlock className="h-[160px] w-full mb-4" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-12 rounded-[8px]" />
              ))}
            </div>
          </SkeletonCard>
        </div>

        {/* ── Row 4: Volume trend + Response time trend ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i}>
              <div className="space-y-2 mb-4">
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="h-3.5 w-52" />
              </div>
              <SkeletonBlock className="h-[140px] w-full" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  );
}
