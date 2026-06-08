"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getConversationPageAction,
  getRecentActiveConversationsAction,
} from "@/lib/actions/dashboard";
import { formatRelativeTime } from "@/helpers/format";
import type { ConversationRow as ConversationRowType } from "@/types/api";

// ── Status pill ──
const StatusPill = ({ status }: { status: string }) => {
  if (status === "human") {
    return (
      <span className="badge-base badge-warning text-[10px] px-1.5 py-0.5">
        Manual
      </span>
    );
  }
  if (status === "pending_handoff") {
    return (
      <span className="badge-base badge-danger text-[10px] px-1.5 py-0.5">
        Pending
      </span>
    );
  }
  return (
    <span className="badge-base badge-success text-[10px] px-1.5 py-0.5">
      KUN
    </span>
  );
};

// ── Empty state ──
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
    <div className="text-3xl mb-2">💬</div>
    <div className="text-[13px] font-semibold text-(--color-text-500)">
      Belum ada percakapan
    </div>
    <div className="text-[11.5px] text-(--color-text-400) mt-1 leading-relaxed">
      Percakapan akan muncul di sini setelah pelanggan mulai chat
    </div>
  </div>
);

// ── Sort — pending always first, then by lastMessageAt desc ──
const sortConversations = (
  convos: ConversationRowType[],
): ConversationRowType[] => {
  return [...convos].sort((a, b) => {
    const aIsPending = a.handoffStatus === "pending_handoff";
    const bIsPending = b.handoffStatus === "pending_handoff";
    if (aIsPending && !bIsPending) return -1;
    if (!aIsPending && bIsPending) return 1;
    const aTime = a.lastMessageAt
      ? new Date(a.lastMessageAt).getTime()
      : new Date(a.createdAt).getTime();
    const bTime = b.lastMessageAt
      ? new Date(b.lastMessageAt).getTime()
      : new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
};

interface RecentConversationsPanelProps {
  initialConversations: ConversationRowType[];
}

const RecentConversationsPanel = ({
  initialConversations,
}: RecentConversationsPanelProps) => {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  // Self-fetching via TanStack Query — PusherProvider invalidates this key
  // on every conversation:new, conversation:message, conversation:takeover, conversation:return
  const { data } = useQuery({
    queryKey: ["conversations", "recent"],
    queryFn: getRecentActiveConversationsAction,
    initialData: initialConversations,
    initialDataUpdatedAt: 0,
    staleTime: 0, // No staleTime — always refetch when invalidated by Pusher
  });

  // Sort is derived — no extra state needed, data from query is already sorted by DB
  // but client-side sort keeps it correct after optimistic updates
  const conversations = useMemo(() => sortConversations(data ?? []), [data]);

  // Live relative time ticker — aligned to real minute boundaries
  useEffect(() => {
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: number | null = null;

    const timeoutId = window.setTimeout(() => {
      setNow(Date.now());
      intervalId = window.setInterval(() => {
        setNow(Date.now());
      }, 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const handleClick = useCallback(
    async (conversationId: number) => {
      try {
        const page = await getConversationPageAction(conversationId);
        router.push(
          `/dashboard/conversations?page=${page}&highlight=${conversationId}`,
        );
      } catch {
        router.push(`/dashboard/conversations?highlight=${conversationId}`);
      }
    },
    [router],
  );

  const pendingCount = conversations.filter(
    (c) => c.handoffStatus === "pending_handoff",
  ).length;

  const displayed = conversations.slice(0, 5);

  return (
    <div className="card-base flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-(--color-border-sm) flex-shrink-0">
        <div>
          <div className="text-[14px] font-bold text-(--color-text-900)">
            Percakapan Perlu Ditangani
          </div>
          <div className="text-[11px] text-(--color-text-400) mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} menunggu staff · ${conversations.length} percakapan aktif`
              : conversations.length > 0
                ? `${conversations.length} percakapan aktif`
                : "Semua percakapan tertangani"}
          </div>
        </div>
        <button
          onClick={() => router.push("/dashboard/conversations")}
          className="text-[11.5px] font-semibold text-(--color-brand) hover:underline flex-shrink-0"
        >
          Lihat semua →
        </button>
      </div>

      {/* List */}
      <div
        className="overflow-y-auto flex-1 min-h-0
          [&::-webkit-scrollbar]:w-[4px]
          [&::-webkit-scrollbar-thumb]:bg-(--color-border-sm)
          hover:[&::-webkit-scrollbar-thumb]:bg-(--color-border)"
      >
        {displayed.length === 0 ? (
          <EmptyState />
        ) : (
          displayed.map((convo) => {
            const isPending = convo.handoffStatus === "pending_handoff";

            return (
              <button
                key={convo.id}
                onClick={() => void handleClick(convo.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-(--color-border-sm) last:border-0 transition-colors hover:bg-(--color-bg-page) group ${
                  isPending ? "bg-(--color-danger-bg)/40" : ""
                }`}
                aria-label={`Buka percakapan ${convo.sessionId.slice(0, 8)}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10.5px] text-(--color-text-400) bg-(--color-bg-page) px-1.5 py-0.5 rounded-[4px] border border-(--color-border) flex-shrink-0">
                      #{convo.sessionId.slice(0, 8)}
                    </span>
                    <span
                      className="text-[10.5px] text-(--color-text-400) truncate"
                      suppressHydrationWarning
                    >
                      {formatRelativeTime(
                        convo.lastMessageAt ?? convo.createdAt,
                        now,
                      )}
                    </span>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusPill status={convo.handoffStatus} />
                  </div>
                </div>

                <div className="text-[12px] text-(--color-text-700) line-clamp-2 leading-snug group-hover:text-(--color-text-900) transition-colors">
                  {convo.lastMessage ? (
                    `"${convo.lastMessage}"`
                  ) : (
                    <span className="text-(--color-text-400) italic">
                      Belum ada pesan
                    </span>
                  )}
                </div>

                <div className="mt-1.5 text-[10.5px] text-(--color-text-400)">
                  {convo.messageCount} pesan aktif
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecentConversationsPanel;
