"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { ChatbotConfig } from "@/types/chat";

// ─── Sub-components ───

// Animated typing cursor shown at the end of a streaming message
const StreamingCursor = () => {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-[2px] h-[1em] ml-[2px] align-middle animate-pulse"
      style={{ background: "currentColor", opacity: 0.6 }}
    />
  );
};

// Typing indicator — shown while waiting for the first token
const TypingIndicator = ({ accentColor }: { accentColor: string }) => {
  return (
    <div className="flex items-end gap-2 mb-4">
      {/* Bot avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
        style={{ background: accentColor }}
        aria-hidden="true"
      >
        AI
      </div>
      {/* Animated dots */}
      <div
        className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ background: "#f0f2f4" }}
        role="status"
        aria-label="Asisten sedang mengetik"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[6px] h-[6px] rounded-full animate-bounce"
            style={{
              background: "#9ca3af",
              animationDelay: `${i * 0.15}s`,
              animationDuration: "0.8s",
            }}
          />
        ))}
      </div>
    </div>
  );
};

// A single message bubble — user or assistant
const MessageBubble = ({
  role,
  content,
  isStreaming,
  accentColor,
  botName,
}: {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean | undefined;
  accentColor: string;
  botName: string;
}) => {
  const isUser = role === "user";

  return (
    <div
      className={`flex items-end gap-2 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
          style={{ background: accentColor }}
          aria-hidden="true"
        >
          AI
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-2xl rounded-br-sm text-white"
            : "rounded-2xl rounded-bl-sm text-gray-800"
        }`}
        style={{
          background: isUser ? accentColor : "#f0f2f4",
        }}
        // Screen readers announce message role
        aria-label={`${isUser ? "Kamu" : botName}: ${content}`}
      >
        {/* Preserve line breaks from the AI response */}
        {content.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            {i < content.split("\n").length - 1 && <br />}
          </span>
        ))}
        {/* Streaming cursor at end of in-progress message */}
        {isStreaming && <StreamingCursor />}
      </div>
    </div>
  );
};

// ─── Main component ───

interface ChatPageProps {
  config: ChatbotConfig;
  orgSlug: string;
  orgName: string;
}

const ChatPage = ({ config, orgSlug, orgName }: ChatPageProps) => {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    errorType,
    sessionId,
    setSessionId,
    clearError,
  } = useChatStore();

  const { sendMessage } = useChatStream(orgSlug);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasGreeted, setHasGreeted] = useState(false);

  // Generate a session ID once on mount — persisted in Zustand for this browser session
  useEffect(() => {
    if (!sessionId) {
      setSessionId(crypto.randomUUID());
    }
  }, [sessionId, setSessionId]);

  // Show greeting message once on first load if configured — added directly, no streaming
  useEffect(() => {
    if (hasGreeted || !config.greetingMessage || !sessionId) return;

    // Add greeting directly to message list — no streaming needed, it's pre-written
    useChatStore.setState((state) => ({
      messages: [
        ...state.messages,
        {
          localId: crypto.randomUUID(),
          role: "assistant" as const,
          content: config.greetingMessage!,
          isStreaming: false,
        },
      ],
    }));

    setHasGreeted(true);
  }, [hasGreeted, config.greetingMessage, sessionId]);

  // Auto-scroll to bottom when new messages arrive or tokens stream in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-grow textarea as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const isInputDisabled = isStreaming || isLoading;

  return (
    <div
      className="flex flex-col h-screen bg-gray-50"
      // Inject accent color as CSS variable so child elements can reference it
      style={{ "--accent": config.accentColor } as React.CSSProperties}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 shadow-sm flex-shrink-0"
        style={{ background: config.accentColor }}
      >
        {/* Bot avatar */}
        <div
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center 
            text-white font-bold text-sm flex-shrink-0"
        >
          {config.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-white font-700 text-sm font-semibold leading-tight">
            {config.name}
          </div>
          <div className="text-white/75 text-xs">{orgName}</div>
        </div>

        {/* Live indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full bg-white animate-pulse"
            aria-hidden="true"
          />
          <span className="text-white/80 text-xs">Online</span>
        </div>
      </header>

      {/* ── Message list ── */}
      <main
        className="flex-1 overflow-y-auto px-4 py-4"
        // Screen readers announce when new messages arrive
        aria-live="polite"
        aria-label="Percakapan"
      >
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4"
              style={{ background: config.accentColor }}
              aria-hidden="true"
            >
              {config.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-gray-800 font-semibold text-base mb-1">
              Halo! Saya {config.name}
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Tanyakan apa saja tentang {orgName}. Saya siap membantu!
            </p>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.localId}
            role={msg.role}
            content={msg.content}
            isStreaming={msg.isStreaming}
            accentColor={config.accentColor}
            botName={config.name}
          />
        ))}

        {/* Typing indicator — shown while waiting for first token */}
        {isLoading && <TypingIndicator accentColor={config.accentColor} />}

        {/* Quota exceeded — intentional block, not a generic error */}
        {error && errorType === "quota_exceeded" && (
          <div
            className="flex flex-col items-center text-center px-6 py-8 mb-4"
            role="status"
            aria-live="polite"
          >
            {/* Lock icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4"
              style={{ background: `${config.accentColor}18` }}
              aria-hidden="true"
            >
              🔒
            </div>
            <p className="text-gray-800 font-semibold text-sm mb-1">
              Batas pesan telah tercapai
            </p>
            <p className="text-gray-500 text-xs leading-relaxed max-w-[240px]">
              {error}
            </p>
          </div>
        )}

        {/* Generic error banner — rate limit, network issues, etc. */}
        {error && errorType !== "quota_exceeded" && (
          <div
            className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm"
            role="alert"
          >
            <span aria-hidden="true">⚠️</span>
            <span className="flex-1">{error}</span>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
              aria-label="Tutup pesan error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} aria-hidden="true" />
      </main>

      {/* ── Input area ── */}
      <footer className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-gray-300 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isInputDisabled}
            placeholder={
              isInputDisabled ? "Menunggu respons..." : "Ketik pesan kamu..."
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none py-1 max-h-[120px] disabled:opacity-50"
            aria-label="Input pesan"
            // Screen readers announce streaming state
            aria-busy={isInputDisabled}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={isInputDisabled || !input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
            style={{ background: config.accentColor }}
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
          <span className="font-semibold" style={{ color: config.accentColor }}>
            Kundesk
          </span>
        </p>
      </footer>
    </div>
  );
};

export default ChatPage;
