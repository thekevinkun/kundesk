"use client";

import { motion } from "framer-motion";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/animations";

// ── Conversation type — matches getRecentConversations return shape ──
interface Conversation {
  id: number;
  sessionId: string;
  handoffStatus: string;
  deliveryChannel: string;
  createdAt: Date;
  lastMessage: string | null;
  messageCount: number;
}

// ── Relative time formatter — "2 mnt lalu", "1 jam lalu" ──
const formatRelativeTime = (date: Date): string => {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return `${diffDays} hari lalu`;
};

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
  // Default: "ai" — answered automatically
  return (
    <span className="badge-base badge-success">
      <span className="w-1.5 h-1.5 rounded-full bg-(--color-success)" />
      Terjawab
    </span>
  );
};

// ── Channel badge — shows delivery channel in a subtle chip ──
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

// ── Single conversation row ──
const ConversationRow = ({ convo }: { convo: Conversation }) => {
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
        {/* Message count — subtle below preview */}
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

// ── Skeleton row — shown in loading.tsx ──
export const ConversationRowSkeleton = () => (
  <tr>
    {[260, 60, 80, 80, 70].map((w, i) => (
      <td key={i} className="px-4 py-3.5 border-b border-(--color-border-sm)">
        <div className="h-3.5 rounded-[6px] skeleton" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

// ── Empty state ──
const EmptyState = () => (
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

// ── Main export ──
interface ConversationsPageProps {
  conversations: Conversation[];
}

const ConversationsPage = ({ conversations }: ConversationsPageProps) => {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
          Percakapan
        </h1>
        <p className="text-[13px] text-(--color-text-500) mt-1">
          Semua percakapan pelanggan dengan chatbot kamu.
        </p>
      </div>

      {/* Table card */}
      <div className="card-base overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-(--color-border-sm)">
          <div>
            <div className="text-[15px] font-bold text-(--color-text-900)">
              Percakapan Terbaru
            </div>
            <div className="text-[11.5px] text-(--color-text-400) mt-0.5">
              {conversations.length > 0
                ? `${conversations.length} percakapan terakhir`
                : "Belum ada percakapan"}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Pesan", "Sesi", "Channel", "Status", "Waktu"].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400) bg-(--color-bg-page) border-b border-(--color-border-sm) first:rounded-tl-none last:rounded-tr-none"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {conversations.length === 0 ? (
                <EmptyState />
              ) : (
                conversations.map((convo) => (
                  <ConversationRow key={convo.id} convo={convo} />
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default ConversationsPage;
