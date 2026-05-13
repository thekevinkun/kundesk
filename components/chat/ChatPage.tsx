// Chat page — layout + state + effects only
// All UI sub-components live alongside this file in components/chat/

"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { ChatbotConfig } from "@/types/chat";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { QuotaExceededState, GenericErrorBanner } from "./ChatErrorState";

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
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate session ID once on mount — persisted in Zustand for this browser tab
  useEffect(() => {
    if (!sessionId) setSessionId(crypto.randomUUID());
  }, [sessionId, setSessionId]);

  // Show greeting message once on first load — no streaming, it's pre-written
  useEffect(() => {
    if (hasGreeted || !config.greetingMessage || !sessionId) return;

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

  // Auto-scroll to bottom when messages update or tokens stream in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    await sendMessage(trimmed);
  };

  const isInputDisabled = isStreaming || isLoading;

  return (
    <div
      className="flex flex-col h-screen bg-gray-50"
      style={{ "--accent": config.accentColor } as React.CSSProperties}
    >
      {/* Header */}
      <ChatHeader
        name={config.name}
        orgName={orgName}
        accentColor={config.accentColor}
      />

      {/* Message list */}
      <main
        className="flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
        aria-label="Percakapan"
      >
        {/* Empty state — shown before any messages */}
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

        {/* Typing indicator — while waiting for first token */}
        {isLoading && <TypingIndicator accentColor={config.accentColor} />}

        {/* Quota exceeded — centered block, not a red banner */}
        {error && errorType === "quota_exceeded" && (
          <QuotaExceededState error={error} accentColor={config.accentColor} />
        )}

        {/* Generic error — dismissible banner */}
        {error && errorType !== "quota_exceeded" && (
          <GenericErrorBanner error={error} onDismiss={clearError} />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} aria-hidden="true" />
      </main>

      {/* Input area */}
      <ChatInput
        value={input}
        disabled={isInputDisabled}
        accentColor={config.accentColor}
        onChange={setInput}
        onSend={handleSend}
      />
    </div>
  );
};

export default ChatPage;
