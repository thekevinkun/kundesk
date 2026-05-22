import { Skeleton } from "@/components/ui/skeleton";

// Mirrors TeamPage layout — header + invite card + 3 member rows
const TeamLoading = () => {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-4">
        {/* Member count strip skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Invite card skeleton */}
        <div className="card-base p-5">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-64 mb-4" />
          <div className="flex gap-3">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-[140px]" />
            <Skeleton className="h-9 w-[120px]" />
          </div>
        </div>

        {/* Member rows skeleton — 3 placeholder rows */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 card-base">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-32 mb-1.5" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-16 hidden sm:block" />
              <Skeleton className="h-3 w-20 hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamLoading;
