"use client";

import { useQuery } from "@tanstack/react-query";
import { getPendingHandoffCount } from "@/lib/actions/chatbot";

const ConversationCountBadge = () => {
  const { data: count } = useQuery({
    queryKey: ["conversations", "pending-count"],
    queryFn: () => getPendingHandoffCount(),
    // Check every 30s — pending handoffs are time-sensitive
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });

  // Hide badge entirely when no pending handoffs — red badge means action needed
  if (!count) return null;

  return (
    <span
      className="text-[10.5px] font-bold min-w-5 h-5 rounded-full flex items-center 
        justify-center px-1.5 bg-red-100 text-red-500"
      aria-label={`${count} percakapan menunggu`}
    >
      {count}
    </span>
  );
};

export default ConversationCountBadge;
