"use client";

import { motion } from "framer-motion";
import { staggerItem } from "@/lib/animations";
import { formatRelativeTime } from "@/helpers/format";
import type { ConversationRow as ConversationRowType } from "@/types/api";

// ── Status pill — maps handoffStatus to design system badge ──
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
      Terjawab
    </span>
  );
};

// ── Channel badge — delivery channel chip ──
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

// ── Empty state — shown when conversation list is empty ──
export const ConversationEmptyState = () => {
  return (
    <tr>
      <td colSpan={5} className="py-14 text-center">
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
};

// ── Skeleton row — used in loading.tsx ──
export const ConversationRowSkeleton = () => {
  return (
    <tr>
      {[260, 60, 80, 80, 70].map((w, i) => (
        <td key={i} className="px-4 py-3.5 border-b border-(--color-border-sm)">
          <div className="h-3.5 rounded-[6px] skeleton" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
};

// ── Single conversation row ──
interface ConversationRowProps {
  convo: ConversationRowType;
}

const ConversationRow = ({ convo }: ConversationRowProps) => {
  return (
    <motion.tr
      variants={staggerItem}
      className="group hover:bg-(--color-bg-page) transition-colors"
    >
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

      {/* Session ID chip */}
      <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
        <span className="font-mono text-[11.5px] text-(--color-text-400) bg-(--color-bg-page) px-2 py-1 rounded-[5px] border border-(--color-border)">
          #{convo.sessionId}
        </span>
      </td>

      {/* Channel */}
      <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
        <ChannelBadge channel={convo.deliveryChannel} />
      </td>

      {/* Status */}
      <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
        <StatusPill status={convo.handoffStatus} />
      </td>

      {/* Relative time */}
      <td className="px-4 py-3.5 border-b border-(--color-border-sm)">
        <span className="text-[12px] text-(--color-text-400) whitespace-nowrap">
          {formatRelativeTime(convo.createdAt)}
        </span>
      </td>
    </motion.tr>
  );
};

export default ConversationRow;
