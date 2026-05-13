"use client";

import { useRef } from "react";

interface ChatInputProps {
  value: string;
  disabled: boolean;
  accentColor: string;
  onChange: (value: string) => void;
  onSend: () => void;
}

const ChatInput = ({
  value,
  disabled,
  accentColor,
  onChange,
  onSend,
}: ChatInputProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // Auto-grow textarea — capped at 120px
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <footer className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-100">
      <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-gray-300 transition-colors">
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Menunggu respons..." : "Ketik pesan kamu..."}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none py-1 max-h-[120px] disabled:opacity-50"
          aria-label="Input pesan"
          aria-busy={disabled}
        />

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
          style={{ background: accentColor }}
          aria-label="Kirim pesan"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22 11 13 2 9l20-7z" />
          </svg>
        </button>
      </div>

      {/* Powered by footer */}
      <p className="text-center text-gray-400 text-[11px] mt-2">
        Powered by{" "}
        <span className="font-semibold" style={{ color: accentColor }}>
          Kundesk
        </span>
      </p>
    </footer>
  );
};

export default ChatInput;
