import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const SectionSkeleton = () => (
  <div className="card-base p-6">
    <Skeleton className="h-5 w-32 mb-1.5" />
    <Skeleton className="h-3.5 w-64 mb-5" />
    <Separator className="mb-5 bg-(--color-border-sm)" />
    <div className="space-y-3">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-10 w-full rounded-[10px]" />
      <Skeleton className="h-3 w-48" />
    </div>
  </div>
);

export default function SettingsLoading() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Skeleton className="h-7 w-52 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-4 max-w-2xl">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    </div>
  );
}
