import { create } from "zustand";
import type { ChatStore } from "@/types/chat";

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  sessionId: "",
  isStreaming: false,
  error: null,
  // Tracks whether the error is quota-related or generic — drives different UI in ChatPage
  errorType: null,

  setSessionId: (id) => set({ sessionId: id }),

  // Adds the user's message to the list immediately — optimistic UI
  addUserMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          localId: crypto.randomUUID(),
          role: "user",
          content,
        },
      ],
      error: null,
      errorType: null,
    })),

  // Adds an empty assistant message bubble that tokens will stream into
  startAssistantMessage: () => {
    const localId = crypto.randomUUID();
    set((state) => ({
      messages: [
        ...state.messages,
        {
          localId,
          role: "assistant",
          content: "",
          isStreaming: true,
        },
      ],
      isLoading: false,
      isStreaming: true,
    }));
    return localId;
  },

  // Appends a single token to the streaming assistant message
  appendToken: (localId, token) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.localId === localId ? { ...m, content: m.content + token } : m,
      ),
    })),

  // Marks the assistant message as complete — removes streaming cursor
  finalizeAssistantMessage: (localId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.localId === localId ? { ...m, isStreaming: false } : m,
      ),
      isStreaming: false,
    })),

  // Generic error setter — errorType defaults to "generic"
  setError: (error) =>
    set({ error, errorType: "generic", isLoading: false, isStreaming: false }),

  // Typed error setter — used by useChatStream for specific error types
  setErrorWithType: (error, errorType) =>
    set({ error, errorType, isLoading: false, isStreaming: false }),

  setLoading: (isLoading) => set({ isLoading }),

  // Clears both error message and type together — never leave them out of sync
  clearError: () => set({ error: null, errorType: null }),
}));
