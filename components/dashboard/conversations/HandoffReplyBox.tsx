"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

interface HandoffReplyBoxProps {
  conversationId: number;
  onReturn: () => void; // called after successful return-to-AI
}

const HandoffReplyBox = ({
  conversationId,
  onReturn,
}: HandoffReplyBoxProps) => {
  const [content, setContent] = useState("");
  const [isSending, startSendTransition] = useTransition();
  const [isReturning, startReturnTransition] = useTransition();

  // Sends a human_agent message to the conversation
  const handleSend = () => {
    if (!content.trim()) return;

    startSendTransition(async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() }),
        });

        if (!res.ok) throw new Error("Failed to send reply");

        // Clear input after successful send
        setContent("");
        toast.success("Pesan terkirim");
      } catch {
        toast.error("Gagal mengirim pesan. Coba lagi.");
      }
    });
  };

  // Returns control back to AI — calls return route then notifies parent
  const handleReturn = () => {
    startReturnTransition(async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/return`, {
          method: "POST",
        });

        if (!res.ok) throw new Error("Failed to return to AI");

        toast.success("AI kembali menangani percakapan");
        onReturn();
      } catch {
        toast.error("Gagal mengembalikan ke AI. Coba lagi.");
      }
    });
  };

  // Send on Enter, newline on Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-(--color-brand-light) border-t border-(--color-brand-mid) px-4 py-3">
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-(--color-brand) uppercase tracking-[0.08em]">
          ✍️ Balas sebagai Staff
        </span>
        <button
          onClick={handleReturn}
          disabled={isReturning}
          className="text-[11.5px] font-semibold text-(--color-text-500) hover:text-(--color-brand) transition-colors disabled:opacity-50"
        >
          {isReturning ? "Mengembalikan..." : "↩ Kembalikan ke AI"}
        </button>
      </div>

      {/* Input row */}
      <div className="flex gap-2 items-end">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tulis balasan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
          rows={2}
          maxLength={1000}
          className="flex-1 input-base resize-none text-[13px] py-2 px-3 min-h-[60px]"
        />
        <button
          onClick={handleSend}
          disabled={isSending || !content.trim()}
          className="btn-brand h-[60px] px-4 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
          aria-label="Kirim balasan"
        >
          {isSending ? <span className="animate-spin">⏳</span> : <>Kirim ↗</>}
        </button>
      </div>

      {/* Char counter */}
      <div className="text-[11px] text-(--color-text-400) mt-1 text-right">
        {content.length}/1000
      </div>
    </div>
  );
};

export default HandoffReplyBox;
