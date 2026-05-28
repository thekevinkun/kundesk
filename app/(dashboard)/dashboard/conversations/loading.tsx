import {
  ConversationCardSkeleton,
  ConversationRowSkeleton,
} from "@/components/dashboard/conversations";

export default function ConversationsLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <div className="mb-6">
        <div className="h-7 w-40 rounded-[10px] skeleton mb-2" />
        <div className="h-4 w-64 rounded-[8px] skeleton" />
      </div>

      {/* Desktop table card skeleton */}
      <div className="hidden md:block card-base overflow-hidden">
        {/* Card header */}
        <div className="px-5 pt-5 pb-3 border-b border-(--color-border-sm)">
          <div className="h-5 w-36 rounded-[8px] skeleton mb-1.5" />
          <div className="h-3.5 w-48 rounded-[6px] skeleton" />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Pesan", "Sesi", "Channel", "Status", "Waktu"].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400) bg-(--color-bg-page) border-b border-(--color-border-sm)"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <ConversationRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card skeleton */}
      <div className="md:hidden space-y-3">
        <div className="card-base p-4">
          <div className="h-5 w-36 rounded-[8px] skeleton mb-1.5" />
          <div className="h-3.5 w-48 rounded-[6px] skeleton" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ConversationCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
