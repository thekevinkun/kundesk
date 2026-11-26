"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import QueueRowItem from "@/components/dashboard/QueueRowItem";
import {
  getConversationPageAction,
  getRecentActiveConversationsAction,
} from "@/lib/actions/dashboard";
import {
  QUEUE_CAP_DESKTOP,
  QUEUE_CAP_MOBILE,
  QUEUE_FETCH_LIMIT,
  countQueue,
  filterQueue,
  getQueueOverflow,
  sortQueue,
} from "@/helpers/conversation-queue";
import type { ConversationRow as ConversationRowType } from "@/types/api";
import type { QueueFilter } from "@/types/dashboard";

// Chips in display order — counts come from countQueue
const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "pending_handoff", label: "Butuh Admin" },
  { value: "ai", label: "KUN" },
  { value: "human", label: "Manual" },
];

// ── Empty state — different words when a filter hides everything ──
const EmptyState = ({ filtered }: { filtered: boolean }) => (
  <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
    <div className="mb-2 text-3xl">💬</div>
    <div className="text-[13px] font-semibold text-(--color-text-500)">
      {filtered ? "Tidak ada percakapan di filter ini" : "Belum ada percakapan"}
    </div>
    <div className="mt-1 text-[11.5px] leading-relaxed text-(--color-text-400)">
      {filtered
        ? "Pilih filter lain untuk melihat percakapan aktif"
        : "Percakapan akan muncul di sini setelah pelanggan mulai chat"}
    </div>
  </div>
);

// ── Footer shown when the cap hides rows — mobile and desktop have different caps ──
const OverflowFooter = ({
  hidden,
  hiddenPending,
  onOpen,
  className,
}: {
  hidden: number;
  hiddenPending: number;
  onOpen: () => void;
  className: string;
}) => (
  <button
    type="button"
    onClick={onOpen}
    className={`w-full flex-shrink-0 items-center justify-center gap-1 border-t border-(--color-border-sm) px-4 py-2.5 text-[11.5px] font-semibold text-(--color-brand) transition-colors hover:bg-(--color-bg-page) ${className}`}
  >
    Lihat {hidden} percakapan lainnya
    {hiddenPending > 0 && (
      <span className="text-(--color-danger)">
        · {hiddenPending} menunggu staff
      </span>
    )}
    <span aria-hidden="true">→</span>
  </button>
);

interface RecentConversationsPanelProps {
  initialConversations: ConversationRowType[];
}

const RecentConversationsPanel = ({
  initialConversations,
}: RecentConversationsPanelProps) => {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<QueueFilter>("all");

  // Self-fetching via TanStack Query — PusherProvider invalidates this key
  // on every conversation:new, conversation:message, conversation:takeover, conversation:return
  const { data } = useQuery({
    queryKey: ["conversations", "recent"],
    queryFn: getRecentActiveConversationsAction,
    initialData: initialConversations,
    initialDataUpdatedAt: 0,
    staleTime: 0, // No staleTime — always refetch when invalidated by Pusher
    refetchOnWindowFocus: false,
  });

  // Pending first, then newest — keeps the order right after Pusher updates too
  const conversations = useMemo(() => sortQueue(data ?? []), [data]);
  // Chip numbers count every fetched row, not only the visible ones
  const counts = useMemo(() => countQueue(conversations), [conversations]);
  // The filter applies BEFORE the cap, so "Butuh Admin" can never look empty by accident
  const filtered = useMemo(
    () => filterQueue(conversations, filter),
    [conversations, filter],
  );
  const displayed = useMemo(
    () => filtered.slice(0, QUEUE_CAP_DESKTOP),
    [filtered],
  );
  const overflowDesktop = getQueueOverflow(filtered, QUEUE_CAP_DESKTOP);
  const overflowMobile = getQueueOverflow(filtered, QUEUE_CAP_MOBILE);

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

  const openAll = useCallback(() => {
    router.push("/dashboard/conversations");
  }, [router]);

  // The fetch is capped, so a full result means "at least this many"
  const totalLabel =
    counts.all >= QUEUE_FETCH_LIMIT
      ? `${QUEUE_FETCH_LIMIT}+`
      : String(counts.all);

  return (
    <div className="card-base flex h-full min-h-[300px] flex-col overflow-hidden xl:min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-(--color-border-sm) px-4 pb-3 pt-4">
        <div>
          <div className="text-[14px] font-bold text-(--color-text-900)">
            Percakapan Perlu Ditangani
          </div>
          <div
            className="mt-0.5 text-[11px] text-(--color-text-400)"
            aria-live="polite"
          >
            {counts.pending_handoff > 0
              ? `${counts.pending_handoff} menunggu staff · ${totalLabel} percakapan aktif`
              : counts.all > 0
                ? `${totalLabel} percakapan aktif`
                : "Semua percakapan tertangani"}
          </div>
        </div>
        <button
          onClick={openAll}
          className="flex-shrink-0 text-[11.5px] font-semibold text-(--color-brand) hover:underline"
        >
          Lihat semua →
        </button>
      </div>

      {/* Filter chips with live counts */}
      <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-(--color-border-sm) px-4 py-2.5">
        {FILTERS.map(({ value, label }) => {
          const selected = filter === value;
          // A waiting customer should be visible on the chip even when it is not selected
          const urgent = value === "pending_handoff" && counts[value] > 0;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                selected
                  ? "bg-(--color-brand) text-white"
                  : urgent
                    ? "bg-(--color-danger-bg) text-(--color-danger)"
                    : "bg-(--color-bg-page) text-(--color-text-500) hover:text-(--color-text-900)"
              }`}
            >
              {label}
              <span className="ml-1 tabular-nums opacity-80">
                {counts[value]}
              </span>
            </button>
          );
        })}
      </div>

      {/* List — at most five rows; a scrollbar appears only if rows are taller than expected */}
      <div
        className="min-h-0 flex-1 overflow-y-auto
          [&::-webkit-scrollbar]:w-[4px]
          [&::-webkit-scrollbar-thumb]:bg-(--color-border-sm)
          hover:[&::-webkit-scrollbar-thumb]:bg-(--color-border)"
      >
        {displayed.length === 0 ? (
          <EmptyState filtered={conversations.length > 0} />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {displayed.map((convo, index) => (
                <QueueRowItem
                  key={convo.id}
                  convo={convo}
                  now={now}
                  onOpen={(id) => void handleClick(id)}
                  hiddenOnMobile={index >= QUEUE_CAP_MOBILE}
                  reduceMotion={reduceMotion}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Footers — only one is visible at a time, chosen by breakpoint */}
      {overflowMobile.hidden > 0 && (
        <OverflowFooter
          hidden={overflowMobile.hidden}
          hiddenPending={overflowMobile.hiddenPending}
          onOpen={openAll}
          className="flex xl:hidden"
        />
      )}
      {overflowDesktop.hidden > 0 && (
        <OverflowFooter
          hidden={overflowDesktop.hidden}
          hiddenPending={overflowDesktop.hiddenPending}
          onOpen={openAll}
          className="hidden xl:flex"
        />
      )}
    </div>
  );
};

export default RecentConversationsPanel;
