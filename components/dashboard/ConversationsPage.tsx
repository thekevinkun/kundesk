"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { ConversationRow, ConversationEmptyState } from "./conversations";
import { useConversationStore } from "@/stores/conversation-store";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { usePusherChannel } from "@/hooks/use-pusher-channel";
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
}

const ConversationsPage = ({
  conversations: initialConversations,
}: ConversationsPageProps) => {
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

  const onMessage = useCallback((payload: MessagePayload) => {
    // Only staff replies need live update in the dialog — user/assistant handled by SSE
    if (payload.role !== "human_agent") return;
    setLatestMessage({
      conversationId: payload.conversationId,
      message: {
        // No DB id available from Pusher — use timestamp as temporary key
        id: Date.now(),
        role: payload.role,
        content: payload.content,
        createdAt: new Date().toISOString(),
      },
    });
  }, []);

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
        c.id === payload.conversationId ? { ...c, handoffStatus: "human" } : c,
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
  });

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
                    newMessage={
                      latestMessage?.conversationId === convo.id
                        ? latestMessage.message
                        : null
                    }
                  />
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
