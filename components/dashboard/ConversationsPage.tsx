"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useConversationStore } from "@/stores/conversation-store";

import {
  ConversationRow,
  ConversationMobileCard,
  ConversationEmptyState,
  ConversationEmptyStateCard,
} from "@/components/dashboard/conversations";

import { usePusherChannel } from "@/hooks/use-pusher-channel";
import { getHumanUnreadConversationIdsAction } from "@/lib/actions/dashboard";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type {
  ConversationRow as ConversationRowType,
  ConversationMessage,
} from "@/types/api";
import type {
  TakeoverPayload,
  ReturnPayload,
  MessagePayload,
  NotificationItem,
} from "@/hooks/use-pusher-channel";

interface ConversationsPageProps {
  conversations: ConversationRowType[];
  total: number;
  page: number;
  totalPages: number;
  highlightId: number | null;
}

const ConversationsPage = ({
  conversations: initialConversations,
  total,
  page,
  totalPages,
  highlightId,
}: ConversationsPageProps) => {
  const router = useRouter();

  const { orgId } = useAuth();
  const { prependNotification } = useConversationStore();

  // Local conversations state — starts from server data, updated by Pusher events
  const [conversations, setConversations] =
    useState<ConversationRowType[]>(initialConversations);

  // Latest message from Pusher — passed to ConversationRow so the open dialog updates live
  // null when no new message has arrived yet
  const [latestMessage, setLatestMessage] = useState<{
    conversationId: number;
    message: ConversationMessage;
  } | null>(null);
  const [expandedConversationId, setExpandedConversationId] = useState<
    number | null
  >(highlightId ?? null);

  // Human unread IDs — drives the New badge on individual rows
  const { data: humanUnreadIds = [] } = useQuery({
    queryKey: ["conversations", "human-unread"],
    queryFn: getHumanUnreadConversationIdsAction,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (highlightId == null) return;
    setExpandedConversationId(highlightId);
  }, [highlightId]);

  // Called by ConversationRow after successful takeover API call
  const handleTakeover = useCallback((conversationId: number) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, handoffStatus: "human" } : c,
      ),
    );
  }, []);

  // Called by ConversationRow after successful return-to-AI API call
  const handleReturn = useCallback((conversationId: number) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, handoffStatus: "ai" } : c,
      ),
    );
  }, []);

  // Pusher callbacks — update state when another staff member takes over or returns
  // useCallback prevents infinite reconnect loop in usePusherChannel
  const onTakeover = useCallback((payload: TakeoverPayload) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === payload.conversationId
          ? {
              ...c,
              // Use payload status — pending_handoff stays pending, human becomes human
              handoffStatus: payload.handoffStatus ?? "human",
            }
          : c,
      ),
    );
  }, []);

  const onReturn = useCallback((payload: ReturnPayload) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === payload.conversationId ? { ...c, handoffStatus: "ai" } : c,
      ),
    );
  }, []);

  const onConversationNew = useCallback(
    async (payload: { conversationId: number }) => {
      try {
        // Fetch full conversation shape — same structure as server-rendered rows
        const res = await fetch(`/api/conversations/${payload.conversationId}`);
        const json = (await res.json()) as {
          ok: boolean;
          data: ConversationRowType;
        };
        if (!json.ok || !json.data) return;

        // Prepend — newest conversation at top, matches ORDER BY created_at DESC
        setConversations((prev) => {
          // Deduplicate — Pusher might fire twice in dev strict mode
          if (prev.some((c) => c.id === json.data.id)) return prev;
          // Keep max 10 rows — matches server query limit
          return [json.data, ...prev].slice(0, 10);
        });
      } catch {
        // Non-critical — table still shows existing rows, new one appears on refresh
      }
    },
    [],
  );

  const onConversationMessage = useCallback(async (payload: MessagePayload) => {
    if (payload.content) {
      // Narrow to local const — TypeScript loses the narrowing inside the setState callback
      const content = payload.content;
      // Full payload — update row directly
      setConversations((prev) =>
        prev.map((c) =>
          c.id === payload.conversationId
            ? {
                ...c,
                lastMessage: content.slice(0, 80),
                lastMessageAt: new Date(),
                messageCount: c.messageCount + 1,
              }
            : c,
        ),
      );
    } else {
      // Ping-only event — refetch the row to get latest state
      try {
        const res = await fetch(`/api/conversations/${payload.conversationId}`);
        const json = (await res.json()) as {
          ok: boolean;
          data: ConversationRowType;
        };
        if (!json.ok || !json.data) return;
        setConversations((prev) =>
          prev.map((c) => (c.id === json.data.id ? json.data : c)),
        );
      } catch {
        // Non-critical — row updates on next refresh
      }
    }
  }, []);

  const onMessage = useCallback(
    (payload: MessagePayload) => {
      onConversationMessage(payload);

      // Only update dialog if this is a real message — pings have no role or content
      if (payload.role && payload.content) {
        setLatestMessage({
          conversationId: payload.conversationId,
          message: {
            id: Date.now(),
            role: payload.role,
            content: payload.content,
            createdAt: new Date().toISOString(),
          },
        });
      }
    },
    [onConversationMessage],
  );

  const onNotificationNew = useCallback(
    (item: NotificationItem) => {
      prependNotification(item);
    },
    [prependNotification],
  );

  // Page-level Pusher listener — separate from the global PusherProvider
  // This one carries callbacks so takeover/return update the table live
  usePusherChannel(orgId ?? "", {
    onTakeover,
    onReturn,
    onMessage,
    onNotificationNew,
    onConversationNew,
  });

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
          Percakapan
        </h1>
        <p className="text-[13px] text-(--color-text-500) mt-1">
          Semua percakapan dengan pelanggan kamu.
        </p>
      </div>

      {/* Desktop table card */}
      <div className="hidden md:block card-base overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-(--color-border-sm)">
          <div>
            <div className="text-[15px] font-bold text-(--color-text-900)">
              Percakapan Terbaru
            </div>
            <div className="text-[11.5px] text-(--color-text-400) mt-0.5">
              {total > 0
                ? `${total} percakapan · halaman ${page} dari ${totalPages}`
                : "Belum ada percakapan"}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["", "Pesan", "Sesi", "Channel", "Status", "Waktu"].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left px-4 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400) bg-(--color-bg-page) border-b border-(--color-border-sm)"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {conversations.length === 0 ? (
                <ConversationEmptyState />
              ) : (
                conversations.map((convo) => (
                  <ConversationRow
                    key={convo.id}
                    convo={convo}
                    onTakeover={handleTakeover}
                    onReturn={handleReturn}
                    isExpanded={expandedConversationId === convo.id}
                    onExpandedChange={(expanded) =>
                      setExpandedConversationId(expanded ? convo.id : null)
                    }
                    newMessage={
                      latestMessage?.conversationId === convo.id
                        ? latestMessage.message
                        : null
                    }
                    isHighlighted={highlightId === convo.id}
                    hasUnread={humanUnreadIds.includes(convo.id)}
                  />
                ))
              )}
            </motion.tbody>
          </table>
        </div>

        {/* ── Pagination controls ── */}
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-t border-(--color-border-sm)">
            {/* Result count */}
            <div className="text-[12.5px] text-(--color-text-400)">
              Menampilkan{" "}
              <span className="font-semibold text-(--color-text-700)">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, total)}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-(--color-text-700)">
                {total}
              </span>{" "}
              percakapan
            </div>

            {/* Page buttons */}
            <div className="flex items-center justify-between gap-1.5 sm:justify-end">
              {/* Previous */}
              <button
                onClick={() =>
                  router.push(`/dashboard/conversations?page=${page - 1}`)
                }
                disabled={page <= 1}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[13px] text-(--color-text-500) border border-(--color-border) bg-(--color-bg-page) hover:border-(--color-brand) hover:text-(--color-brand) disabled:opacity-40 disabled:pointer-events-none transition-all"
                aria-label="Halaman sebelumnya"
              >
                ‹
              </button>

              {/* Page number pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  // Show: first, last, current, and 1 page either side of current
                  return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                })
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  // Insert ellipsis where pages are non-consecutive
                  if (idx > 0) {
                    const prev = arr[idx - 1]!;
                    if (p - prev > 1) acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-8 h-8 flex items-center justify-center text-[12px] text-(--color-text-400)"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() =>
                        router.push(`/dashboard/conversations?page=${p}`)
                      }
                      className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-[12.5px] font-semibold border transition-all ${
                        p === page
                          ? "bg-(--color-brand) text-white border-(--color-brand)"
                          : "text-(--color-text-500) border-(--color-border) bg-(--color-bg-page) hover:border-(--color-brand) hover:text-(--color-brand)"
                      }`}
                      aria-label={`Halaman ${p}`}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ),
                )}

              {/* Next */}
              <button
                onClick={() =>
                  router.push(`/dashboard/conversations?page=${page + 1}`)
                }
                disabled={page >= totalPages}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[13px] text-(--color-text-500) border border-(--color-border) bg-(--color-bg-page) hover:border-(--color-brand) hover:text-(--color-brand) disabled:opacity-40 disabled:pointer-events-none transition-all"
                aria-label="Halaman berikutnya"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        <div className="card-base overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-(--color-border-sm)">
            <div>
              <div className="text-[15px] font-bold text-(--color-text-900)">
                Percakapan Terbaru
              </div>
              <div className="text-[11.5px] text-(--color-text-400) mt-0.5">
                {total > 0
                  ? `${total} percakapan · halaman ${page} dari ${totalPages}`
                  : "Belum ada percakapan"}
              </div>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {conversations.length === 0 ? (
              <ConversationEmptyStateCard />
            ) : (
              conversations.map((convo) => (
                <ConversationMobileCard
                  key={convo.id}
                  convo={convo}
                  onTakeover={handleTakeover}
                  onReturn={handleReturn}
                  isExpanded={expandedConversationId === convo.id}
                  onExpandedChange={(expanded) =>
                    setExpandedConversationId(expanded ? convo.id : null)
                  }
                  newMessage={
                    latestMessage?.conversationId === convo.id
                      ? latestMessage.message
                      : null
                  }
                  isHighlighted={highlightId === convo.id}
                  hasUnread={humanUnreadIds.includes(convo.id)}
                />
              ))
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="card-base p-4">
            <div className="text-[12.5px] text-(--color-text-400) mb-3">
              Menampilkan{" "}
              <span className="font-semibold text-(--color-text-700)">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, total)}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-(--color-text-700)">
                {total}
              </span>{" "}
              percakapan
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <button
                onClick={() =>
                  router.push(`/dashboard/conversations?page=${page - 1}`)
                }
                disabled={page <= 1}
                className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[13px] text-(--color-text-500) border border-(--color-border) bg-(--color-bg-page) hover:border-(--color-brand) hover:text-(--color-brand) disabled:opacity-40 disabled:pointer-events-none transition-all"
                aria-label="Halaman sebelumnya"
              >
                ‹
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    return (
                      p === 1 || p === totalPages || Math.abs(p - page) <= 1
                    );
                  })
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0) {
                      const prev = arr[idx - 1]!;
                      if (p - prev > 1) acc.push("...");
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-7 h-7 flex items-center justify-center text-[12px] text-(--color-text-400)"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() =>
                          router.push(`/dashboard/conversations?page=${p}`)
                        }
                        className={`w-7 h-7 rounded-[8px] flex items-center justify-center text-[12px] font-semibold border transition-all ${
                          p === page
                            ? "bg-(--color-brand) text-white border-(--color-brand)"
                            : "text-(--color-text-500) border-(--color-border) bg-(--color-bg-page) hover:border-(--color-brand) hover:text-(--color-brand)"
                        }`}
                        aria-label={`Halaman ${p}`}
                        aria-current={p === page ? "page" : undefined}
                      >
                        {p}
                      </button>
                    ),
                  )}
              </div>

              <button
                onClick={() =>
                  router.push(`/dashboard/conversations?page=${page + 1}`)
                }
                disabled={page >= totalPages}
                className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[13px] text-(--color-text-500) border border-(--color-border) bg-(--color-bg-page) hover:border-(--color-brand) hover:text-(--color-brand) disabled:opacity-40 disabled:pointer-events-none transition-all"
                aria-label="Halaman berikutnya"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ConversationsPage;
