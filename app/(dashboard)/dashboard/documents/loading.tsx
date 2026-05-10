// Shown by Next.js while the documents route is loading
// Matches the card-base shape of DocumentsPage

import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Card skeleton */}
      <div className="card-base overflow-hidden">
        {/* Card header */}
        <div className="px-5 pt-5 pb-3 border-b border-(--color-border-sm)">
          <Skeleton className="h-5 w-32 mb-1.5" />
          <Skeleton className="h-3.5 w-48" />
        </div>

        {/* Row skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3.5 border-b border-(--color-border-sm)"
          >
            <Skeleton className="w-10 h-10 rounded-[10px] flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}

        {/* Upload zone skeleton */}
        <div className="mx-5 my-3">
          <Skeleton className="h-24 w-full rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}
