import { Skeleton } from "@/components/ui/skeleton";

export default function KnowledgeLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Page header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Tabs skeleton — Profil / Dokumen triggers */}
      <div className="flex gap-1 mb-4">
        <Skeleton className="h-9 w-20 rounded-[8px]" />
        <Skeleton className="h-9 w-24 rounded-[8px]" />
      </div>

      {/* Tab content skeleton — approximates the Profil placeholder (default tab) */}
      <div className="card-base overflow-hidden py-14 flex flex-col items-center">
        <Skeleton className="h-10 w-10 rounded-full mb-3" />
        <Skeleton className="h-4 w-56 mb-2" />
        <Skeleton className="h-3.5 w-64" />
      </div>
    </div>
  );
}
