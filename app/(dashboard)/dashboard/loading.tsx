import { StatCardSkeleton } from "@/components/dashboard";

export default function DashboardLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <div className="mb-6">
        <div className="h-7 w-36 rounded-[10px] skeleton mb-2" />
        <div className="h-4 w-52 rounded-[8px] skeleton" />
      </div>

      {/* Stat cards skeleton — 4 columns matching real layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    </div>
  );
}
