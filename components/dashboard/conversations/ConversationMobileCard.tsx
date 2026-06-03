"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";

import ConversationDialog from "./ConversationDialog";

import { formatRelativeTime } from "@/helpers/format";
import type {
  ConversationRow as ConversationRowType,
  ConversationMessage,
} from "@/types/api";
import {
  ChannelBadge,
  StatusPill,
  useNow,
} from "./ConversationRow";

interface ConversationMobileCardProps {
  convo: ConversationRowType;
  onTakeover: (conversationId: number) => void;
  onReturn: (conversationId: number) => void;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  newMessage: ConversationMessage | null;
  isHighlighted?: boolean;
}

const ConversationMobileCard = ({
  convo,
  onTakeover,
  onReturn,
  isExpanded,
  onExpandedChange,
  newMessage,
  isHighlighted,
}: ConversationMobileCardProps) => {
  const queryClient = useQueryClient();

  const now = useNow(convo.lastMessageAt, convo.createdAt);

  const { unreadConversationIds, clearUnreadConversation, setPendingHandoff } =
    useConversationStore();

  const hasUnread = unreadConversationIds.has(convo.id);

  const [isTakingOver, startTakeoverTransition] = useTransition();
  const [isDismissing, startDismissTransition] = useTransition();

  const [handoffStatus, setHandoffStatus] = useState(convo.handoffStatus);
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isExpired =
    convo.lastMessageAt !== null &&
    Date.now() - new Date(convo.lastMessageAt).getTime() > 24 * 60 * 60 * 1000;

  const handleTakeover = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTakeoverTransition(async () => {
      try {
        const res = await fetch(`/api/conversations/${convo.id}/takeover`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to take over");
        setHandoffStatus("human");
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
        toast.success("Permintaan diabaikan. KUN kembali menangani percakapan.");
      } catch {
        toast.error("Gagal mengabaikan. Coba lagi.");
      }
    });
  };

  const handleStaffReplied = () => {
    clearUnreadConversation(convo.id);
    setPendingHandoff(false);
    void queryClient.invalidateQueries({
      queryKey: ["conversations", "pending-count"],
    });
  };

  useEffect(() => {
    setHandoffStatus(convo.handoffStatus);
  }, [convo.handoffStatus]);

  useEffect(() => {
    if (!isHighlighted) return;
    const timer = setTimeout(() => {
      dialogRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [isHighlighted]);

  useEffect(() => {
    if (!isExpired) return;

    clearUnreadConversation(convo.id);

    if (
      convo.handoffStatus === "pending_handoff" ||
      handoffStatus === "pending_handoff"
    ) {
      setPendingHandoff(false);
      void queryClient.invalidateQueries({
        queryKey: ["conversations", "pending-count"],
      });
    }
  }, [
    convo.handoffStatus,
    convo.id,
    clearUnreadConversation,
    handoffStatus,
    isExpired,
    queryClient,
    setPendingHandoff,
  ]);

  return (
    <div ref={cardRef} className="card-base overflow-hidden">
      <div
        className={`group cursor-pointer transition-colors ${
          isExpired ? "opacity-50" : "hover:bg-(--color-bg-page)"
        } ${isExpanded ? "bg-(--color-bg-page)" : ""}`}
        onClick={() => {
          if (!isExpanded && !isExpired && hasUnread)
            clearUnreadConversation(convo.id); // Clear unread on open even while pending_handoff is still active.
          onExpandedChange(!isExpanded);
        }}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="relative flex flex-shrink-0 items-center justify-center">
              <div
                className="relative mt-5 flex h-6 w-6 items-end justify-center 
              rounded-full border border-(--color-border) bg-(--color-bg-page)"
              >
                <span
                  className={`text-lg text-(--color-brand) transition-transform inline-block ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                >
                  ›
                </span>
              </div>

              {hasUnread && !isExpanded && (
                <span
                  className="absolute -top-3 -left-2.5 px-1.5 py-0.5 text-[9.5px] text-(--color-brand) 
                  bg-(--color-brand)/30 border border-(--color-brand) rounded-full animate-pulse"
                >
                  New
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] text-(--color-text-700) leading-snug line-clamp-2">
                    {convo.lastMessage ? (
                      `"${convo.lastMessage}"`
                    ) : (
                      <span className="text-(--color-text-400) italic">
                        Belum ada pesan
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-(--color-text-400)">
                    {convo.messageCount} pesan ·{" "}
                    {formatRelativeTime(
                      convo.lastMessageAt ?? convo.createdAt,
                      now,
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isExpired ? (
                    <span className="badge-base badge-neutral text-[10.5px]">
                      Kedaluwarsa
                    </span>
                  ) : (
                    <StatusPill status={handoffStatus} />
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11.5px] text-(--color-text-400) bg-(--color-bg-page) px-2 py-1 rounded-[5px] border border-(--color-border)">
                  #{convo.sessionId.slice(0, 8)}
                </span>
                <ChannelBadge channel={convo.deliveryChannel} />
                {!isExpired && handoffStatus === "ai" && (
                  <button
                    onClick={handleTakeover}
                    disabled={isTakingOver}
                    className="text-[11px] font-semibold text-(--color-brand) hover:underline disabled:opacity-40"
                  >
                    {isTakingOver ? "..." : "Ambil Alih"}
                  </button>
                )}
                {/* Abaikan — staff declines the pending handoff request */}
                {!isExpired && handoffStatus === "pending_handoff" && (
                  <button
                    onClick={handleDismiss}
                    disabled={isDismissing}
                    className="text-[11px] font-semibold text-(--color-danger) hover:underline disabled:opacity-40"
                  >
                    {isDismissing ? "..." : "Abaikan"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={dialogRef}>
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
      </div>
    </div>
  );
};

export default ConversationMobileCard;
