"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@clerk/nextjs";
import { getPendingHandoffCount } from "@/lib/actions/chatbot";
import { getHumanUnreadConversationIdsAction } from "@/lib/actions/dashboard";

const ConversationCountBadge = () => {
  // Reactive active-org id — re-renders this component on org switch
  const { organization } = useOrganization();
  const orgId = organization?.id;

  // Pending handoffs from DB — polled every 60s, invalidated immediately on staff reply
  // orgId in the key — without it, switching orgs kept serving the previous
  // org's cached count until a manual refresh forced a full remount
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["conversations", "pending-count", orgId],
    // 60s — Pusher handles real-time, this is just a missed-event safety net
    queryFn: () => getPendingHandoffCount(),
    enabled: !!orgId,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  // Human mode unread — DB-driven, cross-device, invalidated by PusherProvider on message events
  const { data: humanUnreadIds = [] } = useQuery({
    queryKey: ["conversations", "human-unread", orgId],
    queryFn: getHumanUnreadConversationIdsAction,
    enabled: !!orgId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: 60_000,
  });
  const unreadCount = humanUnreadIds.length;

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
