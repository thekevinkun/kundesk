"use client";

import { useEffect, useState, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useChatStream } from "@/hooks/use-chat-stream";
import {
  ChatHeader,
  ChatInput,
  MessageBubble,
  TypingIndicator,
  QuotaExceededState,
  GenericErrorBanner,
  PendingHandoffState,
} from "@/components/chat";
import type { ChatbotConfig, MessageRole } from "@/types/chat";

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
  role: MessageRole;
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
    channelToken,
    handoffStatus,
    setSessionId,
    setHandoffStatus,
    clearError,
    addHumanAgentMessage,
  } = useChatStore();

  // Derive — single source of truth
  const isHumanMode = handoffStatus !== "ai";

  // Chips visible only before customer sends their first message
  const hasUserMessage = messages.some((m) => m.role === "user");

  const { sendMessage } = useChatStream(orgSlug);

  const [input, setInput] = useState("");
  const [hasGreeted, setHasGreeted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    const trimmed = input.trim();
    // In human mode — allow sending even during streaming (silent SSE, completes instantly)
    if (!trimmed || (!isHumanMode && isStreaming)) return;
    setInput("");
    await sendMessage(trimmed);
  };

  // Chip tap: fill input and send immediately
  const handleQuickReply = async (text: string) => {
    if (hasUserMessage || isStreaming || isLoading) return;
    await sendMessage(text);
  };

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

    if (!key || !cluster || !orgId || !channelToken) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import("pusher-js").then((mod) => {
      if (cancelled) return;

      const PusherClient = mod.default;

      // Chat widget uses a public channel — customers don't have Clerk sessions
      // so we can't use private channels here. The channel is org-scoped so
      // one customer can't receive another org's messages.
      const pusher = new PusherClient(key, {
        cluster,
        forceTLS: true,
      });

      // UUID-based channel — unguessable, prevents enumeration
      const channelName = `conversation-${channelToken}`;
      const channel = pusher.subscribe(channelName);

      channel.bind("conversation:message", (payload: PusherMessagePayload) => {
        if (
          conversationId === null ||
          payload.conversationId !== conversationId
        ) {
          return;
        }
        if (payload.role === "human_agent") {
          addHumanAgentMessage(payload.content);
          // Admin replied — transition from pending_handoff to human immediately
          // No SSE fires to customer on staff reply — Pusher is the only signal
          setHandoffStatus("human");
        }
      });

      cleanup = () => {
        channel.unbind_all();
        pusher.unsubscribe(channelName);
        pusher.disconnect();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [orgId, addHumanAgentMessage, conversationId, channelToken]);

  // Notify parent window (widget iframe) when a new bot/staff message arrives
  // Widget uses this to increment the unread badge when the panel is closed
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    // Only fire for assistant and human_agent — not the user's own messages
    if (last.role === "user") return;
    // postMessage to parent — safe even when not in an iframe (no-op)
    window.parent.postMessage({ type: "kundesk:new_message" }, "*");
  }, [messages]);

  // In human mode — input stays enabled, customer can send freely
  const isInputDisabled = isHumanMode ? false : isStreaming || isLoading;

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

        {handoffStatus === "pending_handoff" && (
          <PendingHandoffState accentColor={config.accentColor} />
        )}

        <div ref={messagesEndRef} aria-hidden="true" />
      </main>

      {/* Quick reply chips — shown only before first user message */}
      {!hasUserMessage &&
        config.quickReplies &&
        config.quickReplies.length > 0 && (
          <div
            role="group"
            aria-label="Pertanyaan cepat"
            className="flex flex-wrap gap-2 px-4 pb-2 mt-2"
          >
            {config.quickReplies.map((chip) => (
              <button
                key={chip}
                onClick={() => handleQuickReply(chip)}
                className="text-sm px-4 py-2 rounded-full border font-medium transition-all active:scale-95 hover:opacity-90 bg-white"
                style={{
                  borderColor: config.accentColor,
                  color: config.accentColor,
                }}
                aria-label={`Tanyakan: ${chip}`}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

      <ChatInput
        value={input}
        disabled={isInputDisabled}
        accentColor={config.accentColor}
        isHumanMode={isHumanMode}
        handoffStatus={handoffStatus}
        onChange={setInput}
        onSend={handleSend}
      />
    </div>
  );
};

export default ChatPage;
