// Inline conversation dialog — slides open below a conversation row
// Shows full message history (customer + AI + staff) in chat bubble layout
// Staff can reply and return to AI from here

"use client";

import { useState, useEffect, useRef, useTransition } from "react";
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
    avatar: "🤖",
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
  // Called when new message arrives via Pusher — parent passes it down
  newMessage: ConversationMessage | null;
}

const ConversationDialog = ({
  conversationId,
  handoffStatus,
  onReturn,
  newMessage,
}: ConversationDialogProps) => {
  const [msgs, setMsgs] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [isSending, startSendTransition] = useTransition();
  const [isReturning, startReturnTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Show reply box for both human and pending_handoff — staff can reply in either state
  const isHuman =
    handoffStatus === "human" || handoffStatus === "pending_handoff";

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
        toast.success("AI kembali menangani percakapan");
        onReturn();
      } catch {
        toast.error("Gagal mengembalikan ke AI. Coba lagi.");
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
          m.role === newMessage.role &&
          m.content === newMessage.content &&
          Math.abs(
            new Date(m.createdAt).getTime() -
              new Date(newMessage.createdAt).getTime(),
          ) < 5000, // within 5 seconds = same message
      );
      if (isDuplicate) return prev;
      return [...prev, newMessage];
    });
  }, [newMessage]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-(--color-border-sm)">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-(--color-text-500) uppercase tracking-[0.06em]">
              Riwayat Percakapan
            </span>
            <span className="text-[11px] bg-(--color-bg-card) border border-(--color-border) px-2 py-0.5 rounded-full text-(--color-text-400)">
              {msgs.length} pesan
            </span>
          </div>

          {/* Return to AI — only shown in human mode */}
          {isHuman && (
            <button
              onClick={handleReturn}
              disabled={isReturning}
              className="text-[12px] font-semibold text-(--color-text-500) hover:text-(--color-brand) transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isReturning ? (
                <span className="animate-spin inline-block">⏳</span>
              ) : (
                "↩ Kembalikan ke AI"
              )}
            </button>
          )}
        </div>

        {/* Message list */}
        <div className="max-h-[320px] overflow-y-auto px-5 py-4 space-y-3">
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
                      <div className="w-6 h-6 rounded-full bg-(--color-bg-card) border border-(--color-border) flex items-center justify-center text-[11px] flex-shrink-0 mb-0.5">
                        {config.avatar}
                      </div>
                    )}

                    <div className="max-w-[70%]">
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
                        {msg.content.split("\n").map((line, i, arr) => (
                          <span key={i}>
                            {line}
                            {i < arr.length - 1 && <br />}
                          </span>
                        ))}
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
          <div ref={bottomRef} />
        </div>

        {/* Reply box — only shown in human mode */}
        {isHuman && (
          <div className="border-t border-(--color-border-sm) px-5 py-3">
            <div className="flex gap-2 items-end">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Balas sebagai staff... (Enter kirim, Shift+Enter baris baru)"
                rows={2}
                maxLength={1000}
                className="flex-1 input-base resize-none text-[13px] py-2 px-3 min-h-[60px]"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !replyContent.trim()}
                className="btn-brand h-[60px] px-4 text-[13px] font-semibold disabled:opacity-50 
                  disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
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
      </div>
    </motion.div>
  );
};

export default ConversationDialog;
