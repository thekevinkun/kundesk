import { useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";

// Handles sending a message and consuming the SSE stream from /api/chat.
// Separated from the component so the UI stays declarative.
export function useChatStream(orgSlug: string) {
  const {
    sessionId,
    addUserMessage,
    startAssistantMessage,
    appendToken,
    finalizeAssistantMessage,
    setError,
    setLoading,
    isStreaming,
  } = useChatStore();

  const sendMessage = useCallback(
    async (content: string) => {
      // Prevent sending while a response is already streaming
      if (isStreaming || !content.trim()) return;

      // Show user message immediately — don't wait for server
      addUserMessage(content);
      setLoading(true);

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

        // Handle non-streaming error responses (rate limit, plan limit, etc.)
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const errorMessage =
            response.status === 402
              ? "Batas pesan bisnis ini telah tercapai. Silakan hubungi mereka langsung."
              : response.status === 429
                ? "Terlalu banyak pesan. Tunggu sebentar dan coba lagi."
                : ((err as { error?: string }).error ??
                  "Terjadi kesalahan. Coba lagi.");
          setError(errorMessage);
          return;
        }

        if (!response.body) {
          setError("Tidak ada respons dari server.");
          return;
        }

        // Create an assistant message bubble and start streaming tokens into it
        const localId = startAssistantMessage();

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

            // [DONE] signals end of stream
            if (data === "[DONE]") {
              finalizeAssistantMessage(localId);
              return;
            }

            try {
              const parsed = JSON.parse(data) as
                | { token: string }
                | { error: string };

              if ("error" in parsed) {
                setError(parsed.error);
                return;
              }

              if ("token" in parsed) {
                appendToken(localId, parsed.token);
              }
            } catch {
              // Malformed SSE line — skip silently
            }
          }
        }

        // Stream ended without [DONE] — finalize anyway
        finalizeAssistantMessage(localId);
      } catch {
        setError("Koneksi terputus. Periksa internet kamu dan coba lagi.");
      }
    },
    [
      isStreaming,
      sessionId,
      orgSlug,
      addUserMessage,
      setLoading,
      startAssistantMessage,
      appendToken,
      finalizeAssistantMessage,
      setError,
    ],
  );

  return { sendMessage };
}
