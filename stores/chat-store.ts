import { create } from "zustand";
import type { ChatStore } from "@/types/chat";

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  sessionId: "",
  isStreaming: false,
  error: null,

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

  setError: (error) => set({ error, isLoading: false, isStreaming: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearError: () => set({ error: null }),
}));
