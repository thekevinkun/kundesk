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
      // Full payload — update row directly
      setConversations((prev) =>
        prev.map((c) =>
          c.id === payload.conversationId
            ? {
                ...c,
                lastMessage: payload.content.slice(0, 80),
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
      // Update row preview live — all roles update the last message
      onConversationMessage(payload);

      // Pass to open dialog — all roles, dedup handled inside ConversationDialog
      setLatestMessage({
        conversationId: payload.conversationId,
        message: {
          id: Date.now(),
          role: payload.role,
          content: payload.content,
          createdAt: new Date().toISOString(),
        },
      });
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
