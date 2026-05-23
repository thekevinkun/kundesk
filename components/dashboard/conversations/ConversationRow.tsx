"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";
import { ConversationDialog } from "@/components/dashboard/conversations";
import { staggerItem } from "@/lib/animations";
import { formatRelativeTime } from "@/helpers/format";
import type {
  ConversationRow as ConversationRowType,
  ConversationMessage,
} from "@/types/api";

// ── Status pill ──
const StatusPill = ({ status }: { status: string }) => {
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
      AI
    </span>
  );
};

// ── Channel badge ──
const ChannelBadge = ({ channel }: { channel: string }) => {
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

// ── Single conversation row ──
interface ConversationRowProps {
  convo: ConversationRowType;
  onTakeover: (conversationId: number) => void;
  onReturn: (conversationId: number) => void;
  // New message from Pusher — passed down from ConversationsPage
  newMessage: ConversationMessage | null;
  isHighlighted?: boolean;
}

const ConversationRow = ({
  convo,
  onTakeover,
  onReturn,
  newMessage,
  isHighlighted,
}: ConversationRowProps) => {
  const queryClient = useQueryClient();

  // Read unread state + clear actions from store
  const { unreadConversationIds, clearUnreadConversation, setPendingHandoff } =
    useConversationStore();

  // This row has unread customer messages waiting for staff response
  const hasUnread = unreadConversationIds.has(convo.id);

  const [isTakingOver, startTakeoverTransition] = useTransition();
  const [handoffStatus, setHandoffStatus] = useState(convo.handoffStatus);

  // Auto-open when navigated from search — isHighlighted means this row was the target
  const [isExpanded, setIsExpanded] = useState(isHighlighted ?? false);

  const rowRef = useRef<HTMLTableRowElement>(null);

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
        setIsExpanded(true);
        onTakeover(convo.id);
        toast.success("Kamu sekarang menangani percakapan ini");
      } catch {
        toast.error("Gagal mengambil alih. Coba lagi.");
      }
    });
  };

  const handleReturn = () => {
    setHandoffStatus("ai");
    setIsExpanded(false);
    onReturn(convo.id);
  };

  // Called by ConversationDialog after staff sends a reply
  // For pending rows: this is the moment signs clear (not on expand)
  // For human rows: clears the unread dot for this conversation
  const handleStaffReplied = () => {
    // Clear this row's unread dot
    clearUnreadConversation(convo.id);

    // Pending handoff resolved after staff reply
    setPendingHandoff(false);

    // Refetch pending count — DB now shows human instead of pending_handoff
    void queryClient.invalidateQueries({
      queryKey: ["conversations", "pending-count"],
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

    // Remove from unread set — clears row dot, brand badge, chat icon dot
    clearUnreadConversation(convo.id);

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
        ref={rowRef}
        variants={staggerItem}
        onClick={() => {
          if (isExpired) return;

          if (!isExpanded) {
            const isPending =
              convo.handoffStatus === "pending_handoff" ||
              handoffStatus === "pending_handoff";

            if (isPending) {
              // Pending row — do NOT clear any signs on expand
              // Signs only clear when staff actually sends a reply (onStaffReplied)
              // Just expand the dialog so staff can see and respond
            } else {
              // Non-pending row — clear unread dot immediately on expand
              if (hasUnread) clearUnreadConversation(convo.id);
            }
          }

          setIsExpanded((p) => !p);
        }}
        className={`group transition-colors ${
          isExpired
            ? "opacity-40 pointer-events-none"
            : "cursor-pointer hover:bg-(--color-bg-page)"
        } ${isExpanded ? "bg-(--color-bg-page)" : ""}`}
      >
        {/* Expand chevron + unread dot */}
        <td className="pl-4 pr-1 py-3.5 border-b border-(--color-border-sm) w-8">
          <div className="relative inline-flex items-center justify-center">
            <span
              className={`text-xl text-(--color-brand) transition-transform inline-block ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              ›
            </span>
            {/* Unread dot — customer replied in human mode, staff hasn't seen it yet */}
            {hasUnread && !isExpanded && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-(--color-brand) animate-pulse" />
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
                {/* Only show Ambil Alih for AI rows — pending_handoff staff just opens dialog and replies */}
                {handoffStatus === "ai" && (
                  <button
                    onClick={handleTakeover}
                    disabled={isTakingOver}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-(--color-brand) hover:underline disabled:opacity-40"
                  >
                    {isTakingOver ? "..." : "Ambil Alih"}
                  </button>
                )}
              </>
            )}
          </div>
        </td>

        {/* Relative time */}
        <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
          <span className="text-[12px] text-(--color-text-400) whitespace-nowrap">
            {formatRelativeTime(convo.lastMessageAt ?? convo.createdAt)}
          </span>
        </td>
      </motion.tr>

      {/* Inline conversation dialog — slides open below the row */}
      <tr ref={dialogRowRef}>
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
              />
            )}
          </AnimatePresence>
        </td>
      </tr>
    </>
  );
};

export default ConversationRow;
