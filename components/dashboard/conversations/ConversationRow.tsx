// Single conversation row — click to expand inline conversation dialog
// Shows handoff controls and full message history in the expanded panel

"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
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
}

const ConversationRow = ({
  convo,
  onTakeover,
  onReturn,
  newMessage,
}: ConversationRowProps) => {
  const [handoffStatus, setHandoffStatus] = useState(convo.handoffStatus);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTakingOver, startTakeoverTransition] = useTransition();

  const isHuman = handoffStatus === "human";

  // Expired: AI mode AND last message older than 24 hours
  const isExpired =
    convo.handoffStatus === "ai" &&
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

  return (
    <>
      {/* Main row — click anywhere to expand/collapse dialog */}
      <motion.tr
        variants={staggerItem}
        onClick={() => !isExpired && setIsExpanded((p) => !p)}
        className={`group transition-colors ${
          isExpired
            ? "opacity-40 pointer-events-none"
            : "cursor-pointer hover:bg-(--color-bg-page)"
        } ${isExpanded ? "bg-(--color-bg-page)" : ""}`}
      >
        {/* Expand chevron */}
        <td className="pl-4 pr-1 py-3.5 border-b border-(--color-border-sm) w-8">
          <span
            className={`text-xl text-(--color-brand) transition-transform inline-block ${
              isExpanded ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
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
                {!isHuman && (
                  <button
                    onClick={handleTakeover}
                    disabled={isTakingOver}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-(--color-brand) hover:underline disabled:opacity-40"
                    aria-label={`Ambil alih percakapan #${convo.sessionId.slice(0, 8)}`}
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
      <tr>
        <td colSpan={6} className="p-0">
          <AnimatePresence>
            {isExpanded && (
              <ConversationDialog
                conversationId={convo.id}
                handoffStatus={handoffStatus}
                sessionId={convo.sessionId}
                onReturn={handleReturn}
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
