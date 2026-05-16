"use client";

import { useEffect, useState, useRef } from "react";
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
  // orgId needed to subscribe to the correct Pusher channel
  orgId: string;
}

// Payload shape from Pusher conversation:message event
interface PusherMessagePayload {
  conversationId: number;
  role: "user" | "assistant" | "human_agent";
  content: string;
}

const ChatPage = ({ config, orgSlug, orgName, orgId }: ChatPageProps) => {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    errorType,
    sessionId,
    conversationId,
    setSessionId,
    clearError,
    addHumanAgentMessage,
  } = useChatStore();

  const { sendMessage } = useChatStream(orgSlug);

  const [input, setInput] = useState("");
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate session ID once on mount
  useEffect(() => {
    if (!sessionId) setSessionId(crypto.randomUUID());
  }, [sessionId, setSessionId]);

  // Show greeting message once on first load
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Pusher subscription — listens for staff replies during handoff ──
  // Only subscribes when we have orgId and Pusher credentials
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster || !orgId) return;

    let cleanup: (() => void) | undefined;

    import("pusher-js").then((mod) => {
      const PusherClient = mod.default;

      // Chat widget uses a public channel — customers don't have Clerk sessions
      // so we can't use private channels here. The channel is org-scoped so
      // one customer can't receive another org's messages.
      const pusher = new PusherClient(key, {
        cluster,
        forceTLS: true,
      });

      // Subscribe to the org's public channel — different from dashboard private channel
      // We use org-{orgId} (no "private-" prefix) for the customer-facing side
      const channel = pusher.subscribe(`org-${orgId}`);

      channel.bind("conversation:message", (payload: PusherMessagePayload) => {
        // Filter to this session's conversation — prevents cross-session message bleeding
        if (
          conversationId !== null &&
          payload.conversationId !== conversationId
        ) {
          return;
        }
        if (payload.role === "human_agent") {
          addHumanAgentMessage(payload.content);
        }
      });

      cleanup = () => {
        channel.unbind_all();
        pusher.unsubscribe(`org-${orgId}`);
        pusher.disconnect();
      };
    });

    return () => cleanup?.();
  }, [orgId, addHumanAgentMessage, conversationId]);

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
      <ChatHeader
        name={config.name}
        orgName={orgName}
        accentColor={config.accentColor}
      />

      <main
        className="flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
        aria-label="Percakapan"
      >
        {/* Empty state — only shown when no greeting message is configured */}
        {messages.length === 0 && !isLoading && !config.greetingMessage && (
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

        {isLoading && <TypingIndicator accentColor={config.accentColor} />}

        {error && errorType === "quota_exceeded" && (
          <QuotaExceededState error={error} accentColor={config.accentColor} />
        )}

        {error && errorType !== "quota_exceeded" && (
          <GenericErrorBanner error={error} onDismiss={clearError} />
        )}

        <div ref={messagesEndRef} aria-hidden="true" />
      </main>

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
