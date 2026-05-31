"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { ConversationMessage } from "@/types/api";

// Role label and style config
const ROLE_CONFIG = {
  user: {
    label: "Pelanggan",
    align: "justify-end",
    bubble: "bg-(--color-brand) text-white rounded-2xl rounded-br-sm",
    avatar: null,
  },
  assistant: {
    label: "AI",
    align: "justify-start",
    bubble:
      "bg-(--color-bg-page) text-(--color-text-700) rounded-2xl rounded-bl-sm border border-(--color-border)",
    avatar: true,
  },
  human_agent: {
    label: "Staff",
    align: "justify-start",
    bubble:
      "bg-amber-50 text-(--color-text-700) rounded-2xl rounded-bl-sm border border-amber-200",
    avatar: "👤",
  },
} as const;

interface ConversationDialogProps {
  conversationId: number;
  handoffStatus: string;
  sessionId: string;
  // Called after successful return-to-AI
  onReturn: () => void;
  // Called after staff sends first reply in pending mode — clears unread signs
  onStaffReplied?: () => void;
  // Called when new message arrives via Pusher — parent passes it down
  newMessage: ConversationMessage | null;
  isExpired?: boolean;
}

const ConversationDialog = ({
  conversationId,
  handoffStatus,
  onReturn,
  onStaffReplied,
  newMessage,
  isExpired = false,
}: ConversationDialogProps) => {
  const [msgs, setMsgs] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [isSending, startSendTransition] = useTransition();
  const [isReturning, startReturnTransition] = useTransition();

  // Ref for the scrollable message container — we scroll this directly, not the page
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Read-only when expired — no replies, no actions, just history
  const canReply =
    !isExpired &&
    (handoffStatus === "human" || handoffStatus === "pending_handoff");

  const canReturn = !isExpired && handoffStatus === "human";

  const handleSend = () => {
    if (!replyContent.trim()) return;
    const content = replyContent.trim();

    // Optimistic update — append immediately so staff sees their own message
    const optimisticMsg: ConversationMessage = {
      id: Date.now(), // temporary id — Pusher dedup handles collision
      role: "human_agent",
      content,
      createdAt: new Date().toISOString(),
    };
    setMsgs((prev) => [...prev, optimisticMsg]);
    setReplyContent("");

    startSendTransition(async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          // Rollback optimistic message on failure
          setMsgs((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
          throw new Error("Failed");
        }
        // Staff replied successfully — notify parent to clear pending unread signs
        // onStaffReplied is only meaningful on first reply in pending mode
        // calling it on every reply is safe — clearUnreadConversation is idempotent
        onStaffReplied?.();
      } catch {
        toast.error("Gagal mengirim pesan. Coba lagi.");
      }
    });
  };

  const handleReturn = () => {
    startReturnTransition(async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/return`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed");
        toast.success("KUN kembali menangani percakapan");
        onReturn();
      } catch {
        toast.error("Gagal mengembalikan ke KUN. Coba lagi.");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Fetch full message history on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/messages`,
        );
        const json = (await res.json()) as {
          ok: boolean;
          data: ConversationMessage[];
        };
        if (json.ok) setMsgs(json.data);
      } catch {
        toast.error("Gagal memuat riwayat percakapan");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [conversationId]);

  // Append new message from Pusher — arrives via parent prop
  useEffect(() => {
    if (!newMessage) return;
    setMsgs((prev) => {
      // Deduplicate by content + role — optimistic message may already be showing
      const isDuplicate = prev.some(
        (m) =>
          // hard dedupe for server-confirmed duplicates
          m.id === newMessage.id ||
          // optimistic dedupe only for temporary local staff messages
          (m.role === "human_agent" &&
            newMessage.role === "human_agent" &&
            m.id > 1_000_000_000_000 &&
            m.content === newMessage.content &&
            Math.abs(
              new Date(m.createdAt).getTime() -
                new Date(newMessage.createdAt).getTime(),
            ) < 5000),
      );
      if (isDuplicate) return prev;
      return [...prev, newMessage];
    });
  }, [newMessage]);

  // Scroll message container to bottom — scrollIntoView scrolls the page body, avoid it
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [msgs]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="border-t border-(--color-border) bg-(--color-bg-page)">
        {/* Dialog header */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-(--color-border-sm) 
          sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold text-(--color-text-500) uppercase tracking-[0.06em]">
              Riwayat Percakapan
            </span>
            <span className="text-[11px] bg-(--color-bg-card) border border-(--color-border) px-2 py-0.5 rounded-full text-(--color-text-400)">
              {msgs.length} pesan
            </span>
          </div>

          {/* Return to AI — only shown in human mode */}
          {canReturn && (
            <button
              onClick={handleReturn}
              disabled={isReturning}
              className="inline-flex w-full items-center justify-center gap-1 rounded-[10px] border border-(--color-border) bg-(--color-bg-card) px-3 py-2 text-[12px] font-semibold text-(--color-text-500) transition-colors hover:text-(--color-brand) disabled:opacity-50 sm:w-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:justify-start"
            >
              {isReturning ? (
                <span className="animate-spin inline-block">⏳</span>
              ) : (
                "↩ Kembalikan ke KUN"
              )}
            </button>
          )}
        </div>

        {/* Message list */}
        <div
          ref={scrollContainerRef}
          className="max-h-[280px] px-4 py-4 space-y-3 sm:max-h-[320px] sm:px-5 overflow-y-auto
            [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar]:h-[5px]
            [&::-webkit-scrollbar-thumb]:bg-(--color-border-sm)
            hover:[&::-webkit-scrollbar-thumb]:bg-(--color-border)"
        >
          {isLoading ? (
            // Skeleton loading — 3 placeholder bubbles
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="h-8 rounded-2xl skeleton"
                    style={{ width: `${120 + i * 40}px` }}
                  />
                </div>
              ))}
            </div>
          ) : msgs.length === 0 ? (
            <div className="text-center py-6 text-[13px] text-(--color-text-400)">
              Belum ada pesan dalam percakapan ini
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {msgs.map((msg) => {
                const config = ROLE_CONFIG[msg.role];
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-end gap-2 ${config.align}`}
                  >
                    {/* Avatar — left side for non-user */}
                    {config.avatar && (
                      msg.role === "assistant" ? (
                        <Image
                          src="/images/kun_logo.png"
                          alt="KUN"
                          width={18}
                          height={18}
                          className="w-5.5 h-5.5 object-contain brightness-[.85] mb-0.5"
                          aria-hidden="true"
                        />
                    ) : (
                      <span className="text-white text-sm mb-1" aria-hidden="true">
                        {config.avatar}
                      </span>
                    ))}

                    <div className="max-w-[85%] sm:max-w-[70%]">
                      {/* Role label */}
                      <div
                        className={`text-[10px] font-semibold text-(--color-text-400) mb-1 ${
                          msg.role === "user" ? "text-right" : "text-left"
                        }`}
                      >
                        {config.label}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`px-3 py-2 text-[13px] leading-relaxed ${config.bubble}`}
                      >
                        <div className="prose-bubble">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div
                        className={`text-[10px] text-(--color-text-400) mt-0.5 ${
                          msg.role === "user" ? "text-right" : "text-left"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                          // No timeZone — uses device local time automatically
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Reply box — only shown in active human mode */}
        {canReply && (
          <div className="border-t border-(--color-border-sm) px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2 items-stretch sm:flex-row sm:items-end">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Balas sebagai staff... (Enter kirim, Shift+Enter baris baru)"
                rows={2}
                maxLength={1000}
                className="flex-1 input-base resize-none text-[13px] py-2 px-3 min-h-[56px] sm:min-h-[60px]"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !replyContent.trim()}
                className="btn-brand h-11 w-full px-4 text-[13px] font-semibold disabled:opacity-50 
                  disabled:cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap sm:h-[60px] sm:w-auto"
                aria-label="Kirim balasan"
              >
                {isSending ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>Kirim ↗</>
                )}
              </button>
            </div>
            <div className="text-[11px] text-(--color-text-400) mt-1 text-right">
              {replyContent.length}/1000
            </div>
          </div>
        )}

        {/* Read-only notice — shown when conversation has expired */}
        {isExpired && (
          <div className="border-t border-(--color-border-sm) px-5 py-3">
            <p className="text-[12px] text-(--color-text-400) text-center italic">
              Percakapan ini sudah kedaluwarsa — hanya dapat dilihat, tidak
              dapat dibalas.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ConversationDialog;
