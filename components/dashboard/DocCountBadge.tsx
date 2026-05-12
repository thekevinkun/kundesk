"use client";

import { useQuery } from "@tanstack/react-query";
import { getDocumentCount } from "@/lib/actions/chatbot";
import { cn } from "@/lib/utils";

const DocCountBadge = () => {
  const { data: count } = useQuery({
    queryKey: ["documents", "count"],
    queryFn: () => getDocumentCount(),
    // Refetch every 30s in background — stays fresh without hammering the server
    refetchInterval: 30_000,
    // Don't show stale flash on first load — keep previous value until new one arrives
    placeholderData: (prev) => prev,
  });

  // Don't render badge at all while count is unknown — avoids "0" flash
  if (count === undefined) return null;

  return (
    <span
      className={cn(
        "text-[10.5px] font-bold min-w-5 h-5 rounded-full flex items-center justify-center px-1.5",
        "bg-(--color-bg-page) text-(--color-text-400) border border-(--color-border)",
      )}
      aria-label={`${count} dokumen`}
    >
      {count}
    </span>
  );
};

export default DocCountBadge;
