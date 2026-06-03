"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getConversationPageAction } from "@/lib/actions/dashboard";
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
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours — active conversations only.

const isExpiredConversation = (
  convo: ConversationRowType,
  now: number,
): boolean => {
  const anchorTime = convo.lastMessageAt ?? convo.createdAt; // Fall back to creation time when there is no message yet.
  return now - new Date(anchorTime).getTime() > EXPIRY_MS; // Expire once the last activity is older than 24h.
};

const sortConversations = (
  convos: ConversationRowType[],
): ConversationRowType[] => {
  return [...convos].sort((a, b) => {
    const aIsPending = a.handoffStatus === "pending_handoff";
    const bIsPending = b.handoffStatus === "pending_handoff";

    // Pending rows float to top
    if (aIsPending && !bIsPending) return -1;
    if (!aIsPending && bIsPending) return 1;

    // Within same priority group — most recent first
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
  newConversation: ConversationRowType | null;
  latestMessage: ConversationRowType | null;
  latestStatusUpdate: {
    conversationId: number;
    handoffStatus: string;
  } | null;
}

const RecentConversationsPanel = ({
  initialConversations,
  newConversation,
  latestMessage,
  latestStatusUpdate,
}: RecentConversationsPanelProps) => {
  const router = useRouter();

  // Always keep sorted — pending on top
  const [conversations, setConversations] = useState<ConversationRowType[]>(
    () => sortConversations(initialConversations),
  );
  const [now, setNow] = useState(() => Date.now()); // Drives the 24h expiry filter without waiting for new Pusher events.

  // Track seen IDs — deduplicate Pusher new conversation events
  const seenIdsRef = useRef(new Set(initialConversations.map((c) => c.id)));

  // Reset state when initialConversations changes — handles org switch
  // useState initializer only runs on mount; subsequent prop changes are ignored
  useEffect(() => {
    setConversations(sortConversations(initialConversations));
    seenIdsRef.current = new Set(initialConversations.map((c) => c.id));
  }, [initialConversations]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now()); // Recompute expiry on a fixed tick so stale rows drop out automatically.
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  // New conversation prepended from Pusher
  useEffect(() => {
    if (!newConversation) return;
    if (seenIdsRef.current.has(newConversation.id)) return;
    seenIdsRef.current.add(newConversation.id);
    setConversations((prev) =>
      sortConversations([newConversation, ...prev]).slice(0, 10),
    );
  }, [newConversation]);

  // Message preview updated from Pusher — re-sort after update (time changed)
  useEffect(() => {
    if (!latestMessage) return;
    setConversations((prev) =>
      sortConversations([
        {
          ...latestMessage,
          lastMessage: latestMessage.lastMessage?.slice(0, 80) ?? null,
        },
        ...prev.filter((c) => c.id !== latestMessage.id),
      ]).slice(0, 10),
    );
  }, [latestMessage]);

  // Status updated from Pusher — re-sort so pending floats to top immediately
  useEffect(() => {
    if (!latestStatusUpdate) return;
    setConversations((prev) =>
      sortConversations(
        prev.map((c) =>
          c.id === latestStatusUpdate.conversationId
            ? {
                ...c,
                handoffStatus:
                  latestStatusUpdate.handoffStatus as ConversationRowType["handoffStatus"],
              }
            : c,
        ),
      ),
    );
  }, [latestStatusUpdate]);

  const activeConversations = conversations.filter(
    (convo) => !isExpiredConversation(convo, now), // Keep only conversations with activity inside the last 24 hours.
  );

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

  // Pending count for header subtitle
  const pendingCount = activeConversations.filter(
    (c) => c.handoffStatus === "pending_handoff",
  ).length;

  const displayed = activeConversations.slice(0, 5);

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
              ? `${pendingCount} menunggu staff · ${activeConversations.length} percakapan aktif`
              : activeConversations.length > 0
                ? `${activeConversations.length} percakapan aktif`
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
        className="overflow-y-auto
          flex-1 min-h-0
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
                {/* Top row: session ID + time + status */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10.5px] text-(--color-text-400) bg-(--color-bg-page) px-1.5 py-0.5 rounded-[4px] border border-(--color-border) flex-shrink-0">
                      #{convo.sessionId.slice(0, 8)}
                    </span>
                    <span className="text-[10.5px] text-(--color-text-400) truncate">
                      {formatRelativeTime(
                        convo.lastMessageAt ?? convo.createdAt,
                      )}
                    </span>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusPill status={convo.handoffStatus} />
                  </div>
                </div>

                {/* Message preview */}
                <div className="text-[12px] text-(--color-text-700) line-clamp-2 leading-snug group-hover:text-(--color-text-900) transition-colors">
                  {convo.lastMessage ? (
                    `"${convo.lastMessage}"`
                  ) : (
                    <span className="text-(--color-text-400) italic">
                      Belum ada pesan
                    </span>
                  )}
                </div>

                {/* Message count */}
                <div className="mt-1.5 text-[10.5px] text-(--color-text-400)">
                  {convo.messageCount} pesan
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
