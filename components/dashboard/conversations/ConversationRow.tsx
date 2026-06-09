"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";
import { toast } from "sonner";

import { ConversationDialog } from "@/components/dashboard/conversations";

import { staggerItem } from "@/lib/animations";
import { formatRelativeTime } from "@/helpers/format";
import type {
  ConversationRow as ConversationRowType,
  ConversationMessage,
} from "@/types/api";

// ── Status pill ──
export const StatusPill = ({ status }: { status: string }) => {
  if (status === "human") {
    return (
      <span className="badge-base badge-warning">
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-warning)" />
        Manual
      </span>
    );
  }
  if (status === "pending_handoff") {
    return (
      <span className="badge-base badge-danger">
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-danger)" />
        Pending
      </span>
    );
  }
  return (
    <span className="badge-base badge-success">
      <span className="w-1.5 h-1.5 rounded-full bg-(--color-success)" />
      KUN
    </span>
  );
};

// ── Channel badge ──
export const ChannelBadge = ({ channel }: { channel: string }) => {
  const label =
    channel === "whatsapp"
      ? "WhatsApp"
      : channel === "qr_link"
        ? "QR Link"
        : "Web Widget";
  return (
    <span className="text-[11px] text-(--color-text-400) bg-(--color-bg-page) border border-(--color-border) px-2 py-0.5 rounded-[5px] font-medium">
      {label}
    </span>
  );
};

// ── Empty state ──
export const ConversationEmptyState = () => (
  <tr>
    <td colSpan={6} className="py-14 text-center">
      <div className="text-4xl mb-3">💬</div>
      <div className="text-[14px] font-semibold text-(--color-text-500)">
        Belum ada percakapan
      </div>
      <div className="text-[12px] text-(--color-text-400) mt-1">
        Percakapan akan muncul di sini setelah pelanggan mulai chat
      </div>
    </td>
  </tr>
);

// ── Skeleton row ──
export const ConversationRowSkeleton = () => (
  <tr>
    {[260, 60, 80, 80, 70, 40].map((w, i) => (
      <td key={i} className="px-4 py-3.5 border-b border-(--color-border-sm)">
        <div className="h-3.5 rounded-[6px] skeleton" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

export const ConversationEmptyStateCard = () => (
  <div className="card-base p-6 text-center">
    <div className="text-4xl mb-3">💬</div>
    <div className="text-[14px] font-semibold text-(--color-text-500)">
      Belum ada percakapan
    </div>
    <div className="text-[12px] text-(--color-text-400) mt-1">
      Percakapan akan muncul di sini setelah pelanggan mulai chat
    </div>
  </div>
);

export const ConversationCardSkeleton = () => (
  <div className="card-base p-4">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-3.5 rounded-[6px] skeleton w-[75%]" />
        <div className="h-3 rounded-[6px] skeleton w-[45%]" />
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <div className="h-6 w-20 rounded-full skeleton" />
      <div className="h-6 w-24 rounded-full skeleton" />
      <div className="h-6 w-16 rounded-full skeleton" />
    </div>
  </div>
);

// Fixed ticker — aligns to the real minute boundary and then ticks every minute.
// Drives live relative time display without fetching.
export const useNow = (
  anchorTime: Date | string | null,
  fallback: Date | string,
): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000); // Wait for the next real minute boundary.
    let intervalId: number | null = null; // Track the repeating timer after the initial alignment.

    const timeoutId = window.setTimeout(() => {
      setNow(Date.now()); // Snap immediately to the minute rollover.
      intervalId = window.setInterval(() => {
        setNow(Date.now()); // Keep ticking once per real minute after that.
      }, 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId); // Cancel the alignment delay on unmount.
      if (intervalId) window.clearInterval(intervalId); // Stop the repeating tick when cleaned up.
    };
  }, [anchorTime, fallback]);

  return now;
};

// ── Single conversation row ──
interface ConversationRowProps {
  convo: ConversationRowType;
  onTakeover: (conversationId: number) => void;
  onReturn: (conversationId: number) => void;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  newMessage: ConversationMessage | null; // New message from Pusher — passed down from ConversationsPage
  isHighlighted?: boolean;
  hasUnread?: boolean; // Whether this conversation has unread customer messages
}

const ConversationRow = ({
  convo,
  onTakeover,
  onReturn,
  isExpanded,
  onExpandedChange,
  newMessage,
  isHighlighted,
  hasUnread,
}: ConversationRowProps) => {
  const queryClient = useQueryClient();

  const now = useNow(convo.lastMessageAt, convo.createdAt);

  const { setPendingHandoff } = useConversationStore();

  const [isTakingOver, startTakeoverTransition] = useTransition();
  const [isDismissing, startDismissTransition] = useTransition();

  const [handoffStatus, setHandoffStatus] = useState(convo.handoffStatus);

  const dialogRowRef = useRef<HTMLTableRowElement>(null);

  // Expired: all statuses expire after 24h of inactivity
  const isExpired =
    convo.lastMessageAt !== null &&
    Date.now() - new Date(convo.lastMessageAt).getTime() > 24 * 60 * 60 * 1000;

  const handleTakeover = (e: React.MouseEvent) => {
    // Prevent row click from toggling dialog
    e.stopPropagation();
    startTakeoverTransition(async () => {
      try {
        const res = await fetch(`/api/conversations/${convo.id}/takeover`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to take over");
        setHandoffStatus("human");
        // Auto-expand dialog after taking over — staff needs to see the messages
        onExpandedChange(true);
        onTakeover(convo.id);
        toast.success("Kamu sekarang menangani percakapan ini");
      } catch {
        toast.error("Gagal mengambil alih. Coba lagi.");
      }
    });
  };

  const handleReturn = () => {
    setHandoffStatus("ai");
    onExpandedChange(false);
    onReturn(convo.id);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    startDismissTransition(async () => {
      try {
        const res = await fetch(`/api/conversations/${convo.id}/dismiss`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to dismiss");
        // Return to AI locally — Pusher will also fire conversation:return
        // but local state update makes the UI snappy without waiting
        setHandoffStatus("ai");
        setPendingHandoff(false);
        void queryClient.invalidateQueries({
          queryKey: ["conversations", "pending-count"],
        });
        toast.success(
          "Permintaan diabaikan. KUN kembali menangani percakapan.",
        );
      } catch {
        toast.error("Gagal mengabaikan. Coba lagi.");
      }
    });
  };

  // Called by ConversationDialog after staff sends a reply
  const handleStaffReplied = () => {
    // Pending handoff resolved after staff reply
    setPendingHandoff(false);

    // Refetch pending count — DB now shows human instead of pending_handoff
    void queryClient.invalidateQueries({
      queryKey: ["conversations", "pending-count"],
    });

    // Refetch human unread — staff just replied so this conversation is no longer unread
    void queryClient.invalidateQueries({
      queryKey: ["conversations", "human-unread"],
    });
  };

  useEffect(() => {
    setHandoffStatus(convo.handoffStatus);
  }, [convo.handoffStatus]);

  // Scroll into view + flash highlight when navigated from search
  useEffect(() => {
    if (!isHighlighted) return;
    // Wait for dialog to fully expand before scrolling
    const timer = setTimeout(() => {
      dialogRowRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [isHighlighted]);

  // When a conversation expires — clean up all its signals from the store
  // Runs once when isExpired flips true — no cleanup needed on unmount
  useEffect(() => {
    if (!isExpired) return;

    // Clear pending handoff flag if this was the pending conversation
    if (
      convo.handoffStatus === "pending_handoff" ||
      handoffStatus === "pending_handoff"
    ) {
      setPendingHandoff(false);
      // Refetch — DB still has pending_handoff but we want badge to reflect reality
      void queryClient.invalidateQueries({
        queryKey: ["conversations", "pending-count"],
      });
    }
  }, [isExpired]);

  return (
    <>
      {/* Main row — click anywhere to expand/collapse dialog */}
      <motion.tr
        ref={dialogRowRef}
        variants={staggerItem}
        onClick={() => {
          // MANUAL mode — remove optimistically from cache on row click (staff read it)
          // PENDING mode — dot stays until staff actually replies (handled in handleStaffReplied)
          // Cannot use invalidateQueries here — DB still returns this ID until staff replies
          // Optimistic removal gives immediate feedback without a DB round trip
          if (!isExpanded && !isExpired && handoffStatus === "human") {
            queryClient.setQueryData<number[]>(
              ["conversations", "human-unread"],
              (prev) => (prev ?? []).filter((id) => id !== convo.id),
            );
          }

          onExpandedChange(!isExpanded);
        }}
        className={`group transition-colors cursor-pointer ${
          isExpired
            ? "opacity-50 hover:opacity-70"
            : "hover:bg-(--color-bg-page)"
        } ${isExpanded ? "bg-(--color-bg-page)" : ""}`}
      >
        {/* Expand chevron + unread sign */}
        <td className="pl-4 pr-1 py-3.5 border-b border-(--color-border-sm) w-8">
          <div className="relative inline-flex items-center justify-center">
            <span
              className={`text-xl text-(--color-brand) transition-transform inline-block ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              ›
            </span>
            {/* Unread sign — customer replied in human mode, staff hasn't seen it yet */}
            {hasUnread && !isExpanded && (
              <span
                className="absolute -top-4.5 -left-2.5 px-1.5 py-0.5 text-[9.5px] text-(--color-brand) 
                bg-(--color-brand)/30 border border-(--color-brand) rounded-full animate-pulse"
              >
                New
              </span>
            )}
          </div>
        </td>

        {/* Last message preview */}
        <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
          <div className="text-[13px] text-(--color-text-700) max-w-[260px] truncate">
            {convo.lastMessage ? (
              `"${convo.lastMessage}"`
            ) : (
              <span className="text-(--color-text-400) italic">
                Belum ada pesan
              </span>
            )}
          </div>
          <div className="text-[11px] text-(--color-text-400) mt-0.5">
            {convo.messageCount} pesan
          </div>
        </td>

        {/* Session ID */}
        <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
          <span className="font-mono text-[11.5px] text-(--color-text-400) bg-(--color-bg-page) px-2 py-1 rounded-[5px] border border-(--color-border)">
            #{convo.sessionId.slice(0, 8)}
          </span>
        </td>

        {/* Channel */}
        <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
          <ChannelBadge channel={convo.deliveryChannel} />
        </td>

        {/* Status + Take Over */}
        <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
          <div className="flex items-center gap-2">
            {isExpired ? (
              <span className="badge-base badge-neutral text-[10.5px]">
                Kedaluwarsa
              </span>
            ) : (
              <>
                <StatusPill status={handoffStatus} />
                {/* Ambil Alih — only for AI rows */}
                {handoffStatus === "ai" && (
                  <button
                    onClick={handleTakeover}
                    disabled={isTakingOver}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-(--color-brand) hover:underline disabled:opacity-40"
                  >
                    {isTakingOver ? "..." : "Ambil Alih"}
                  </button>
                )}
                {/* Abaikan — only for pending rows, staff declines the takeover request */}
                {handoffStatus === "pending_handoff" && (
                  <button
                    onClick={handleDismiss}
                    disabled={isDismissing}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-(--color-danger) hover:underline disabled:opacity-40"
                  >
                    {isDismissing ? "..." : "Abaikan"}
                  </button>
                )}
              </>
            )}
          </div>
        </td>

        {/* Relative time */}
        <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
          <span
            className="text-[12px] text-(--color-text-400) whitespace-nowrap"
            suppressHydrationWarning
          >
            {formatRelativeTime(convo.lastMessageAt ?? convo.createdAt, now)}
          </span>
        </td>
      </motion.tr>

      {/* Inline conversation dialog — slides open below the row */}
      <tr>
        <td colSpan={6} className="p-0">
          <AnimatePresence>
            {isExpanded && (
              <ConversationDialog
                conversationId={convo.id}
                handoffStatus={handoffStatus}
                sessionId={convo.sessionId}
                onReturn={handleReturn}
                onStaffReplied={handleStaffReplied}
                newMessage={newMessage}
                isExpired={isExpired}
              />
            )}
          </AnimatePresence>
        </td>
      </tr>
    </>
  );
};

export default ConversationRow;
