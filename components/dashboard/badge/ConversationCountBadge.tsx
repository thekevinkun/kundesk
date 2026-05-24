"use client";

import { useQuery } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";
import { getPendingHandoffCount } from "@/lib/actions/chatbot";

const ConversationCountBadge = () => {
  // Pending handoffs from DB — polled every 60s, invalidated immediately on staff reply
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["conversations", "pending-count"],
    // 60s — Pusher handles real-time, this is just a missed-event safety net
    queryFn: () => getPendingHandoffCount(),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  // Unread human mode conversations — in-memory, per-conversation, clears on row click
  const unreadConversationIds = useConversationStore(
    (s) => s.unreadConversationIds,
  );
  const unreadCount = unreadConversationIds.size;

  // Neither badge needed — render nothing
  if (pendingCount === 0 && unreadCount === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {/* Red badge — pending handoff, customer waiting for staff */}
      {pendingCount > 0 && (
        <span
          className="text-[10.5px] font-bold min-w-5 h-5 rounded-full flex items-center
            justify-center px-1.5 bg-red-100 text-red-500"
          aria-label={`${pendingCount} pelanggan menunggu staff`}
        >
          {pendingCount}
        </span>
      )}

      {/* Brand badge — human mode conversations with unread messages */}
      {unreadCount > 0 && (
        <span
          className="text-[10.5px] font-bold min-w-5 h-5 rounded-full flex items-center
            justify-center px-1.5 bg-(--color-brand-light) text-(--color-brand)"
          aria-label={`${unreadCount} percakapan belum dibalas`}
        >
          {unreadCount}
        </span>
      )}
    </div>
  );
};

export default ConversationCountBadge;
