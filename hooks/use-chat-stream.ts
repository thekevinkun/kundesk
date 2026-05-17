import { useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { HandoffStatus } from "@/types/chat";

// Handles sending a message and consuming the SSE stream from /api/chat.
// Separated from the component so the UI stays declarative.
export function useChatStream(orgSlug: string) {
  const {
    sessionId,
    setConversationId,
    setChannelToken,
    addUserMessage,
    startAssistantMessage,
    appendToken,
    finalizeAssistantMessage,
    setError,
    setErrorWithType,
    setLoading,
    isStreaming,
    setHumanMode,
    setHandoffStatus,
  } = useChatStore();

  const sendMessage = useCallback(
    async (content: string) => {
      // Prevent sending while a response is already streaming
      if (isStreaming || !content.trim()) return;

      // Show user message immediately — don't wait for server
      addUserMessage(content);

      // Don't show loading indicator in human mode — no AI response coming
      const { isHumanMode } = useChatStore.getState();
      if (!isHumanMode) setLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            sessionId,
            orgSlug,
          }),
        });

        // Handle non-streaming error responses — typed so ChatPage renders appropriate UI
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));

          if (response.status === 402) {
            // Quota exhausted — ChatPage renders a dedicated block, not a generic error banner
            setErrorWithType(
              "Batas pesan bisnis ini telah tercapai. Silakan hubungi mereka langsung.",
              "quota_exceeded",
            );
            return;
          }

          if (response.status === 429) {
            setErrorWithType(
              "Terlalu banyak pesan. Tunggu sebentar dan coba lagi.",
              "rate_limit",
            );
            return;
          }

          // Generic fallback — unknown error from server
          setError(
            (err as { error?: string }).error ??
              "Terjadi kesalahan. Coba lagi.",
          );
          return;
        }

        if (!response.body) {
          setError("Tidak ada respons dari server.");
          return;
        }

        // Create assistant bubble lazily only when first token arrives
        let localId: string | null = null;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and add to buffer — chunks may split across SSE events
          buffer += decoder.decode(value, { stream: true });

          // Process all complete SSE lines in the buffer
          const lines = buffer.split("\n");
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            // SSE data lines start with "data: "
            if (!line.startsWith("data: ")) continue;

            const data = line.slice(6).trim();

            try {
              const parsed = JSON.parse(data) as
                | { token: string }
                | { error: string }
                | {
                    done: true;
                    conversationId?: number;
                    channelToken?: string;
                    handoffStatus?: string;
                  };

              if ("done" in parsed) {
                if (localId !== null) {
                  finalizeAssistantMessage(localId);
                } else {
                  // Silent response — no tokens, reset loading manually
                  setLoading(false);
                }

                if (parsed.conversationId !== undefined) {
                  setConversationId(parsed.conversationId);
                }

                if (parsed.channelToken !== undefined) {
                  setChannelToken(parsed.channelToken);
                }

                if (parsed.handoffStatus) {
                  const isValidStatus =
                    parsed.handoffStatus === "ai" ||
                    parsed.handoffStatus === "pending_handoff" ||
                    parsed.handoffStatus === "human";

                  if (!isValidStatus) continue;

                  setHandoffStatus(parsed.handoffStatus as HandoffStatus);
                  if (
                    parsed.handoffStatus === "pending_handoff" ||
                    parsed.handoffStatus === "human"
                  ) {
                    setHumanMode(true);
                  } else {
                    setHumanMode(false);
                  }
                }
                return;
              }

              if ("error" in parsed) {
                setError(parsed.error);
                return;
              }

              if ("token" in parsed) {
                if (localId === null) {
                  localId = startAssistantMessage();
                }
                appendToken(localId, parsed.token);
              }
            } catch {
              // Malformed SSE line — skip silently
            }
          }
        }

        // Stream ended without [DONE] — finalize anyway
        if (localId !== null) {
          finalizeAssistantMessage(localId);
        } else {
          setLoading(false);
        }
      } catch {
        setError("Koneksi terputus. Periksa internet kamu dan coba lagi.");
      }
    },
    [
      isStreaming,
      sessionId,
      setConversationId,
      orgSlug,
      addUserMessage,
      setLoading,
      startAssistantMessage,
      appendToken,
      finalizeAssistantMessage,
      setError,
      setErrorWithType,
      setChannelToken,
      setHumanMode,
      setHandoffStatus,
    ],
  );

  return { sendMessage };
}
