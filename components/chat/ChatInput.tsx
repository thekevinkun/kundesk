"use client";

import { useRef } from "react";

interface ChatInputProps {
  value: string;
  disabled: boolean;
  accentColor: string;
  isHumanMode: boolean;
  handoffStatus: string;
  onChange: (value: string) => void;
  onSend: () => void;
}

const ChatInput = ({
  value,
  disabled,
  accentColor,
  isHumanMode,
  handoffStatus,
  onChange,
  onSend,
}: ChatInputProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // In human mode — only block while actively sending (isStreaming handled upstream)
  // Customer can type freely between messages — like WhatsApp
  const isDisabled = isHumanMode ? false : disabled;

  return (
    <footer className="flex-shrink-0 bg-white border-t border-gray-100">
      <div className="px-4 py-3">
        <div
          className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl 
          px-3 py-2 focus-within:border-gray-300 transition-colors"
        >
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder={
              isDisabled && !isHumanMode
                ? "Menunggu respons..."
                : "Ketik pesan kamu..."
            }
            rows={1}
            className="flex-1 resize-none no-zoom bg-transparent text-gray-800 
              placeholder-gray-400 outline-none py-1 max-h-[120px] disabled:opacity-50"
            aria-label="Input pesan"
            aria-busy={isDisabled}
          />

          <button
            onClick={onSend}
            disabled={isDisabled || !value.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center 
              text-white transition-all flex-shrink-0 disabled:opacity-40 
              disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
            style={{ background: accentColor }}
            aria-label="Kirim pesan"
            aria-busy={isDisabled}
          >
            <svg
              width="15"
              height="15"
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

        {/* Footer hint — shows admin tip in AI mode, human warning in human mode */}
        {isHumanMode ? (
          <p
            className="text-center text-[11px] mt-2 font-medium text-amber-600"
            aria-live="polite"
          >
            👤{" "}
            {handoffStatus === "pending_handoff"
              ? "Menunggu staff kami"
              : "Kamu sedang terhubung dengan staff kami"}
          </p>
        ) : (
          <p className="text-center text-gray-400 text-[11px] mt-2">
            Ketik{" "}
            <span className="font-semibold text-gray-500">hubungi admin</span>{" "}
            untuk berbicara dengan staff ·{" "}
            <span className="font-semibold text-[#069494]">Kundesk</span>
          </p>
        )}
      </div>
    </footer>
  );
};

export default ChatInput;
