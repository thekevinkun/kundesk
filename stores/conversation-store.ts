// Shared state for live conversation events received via Pusher
// Written by PusherProvider, read by Topbar (notification bell)
// Zustand avoids prop drilling between layout siblings

import { create } from "zustand";

interface ConversationStore {
  // Unread notification count — increments on conversation:new, resets on bell click
  unreadCount: number;
  incrementUnread: () => void;
  clearUnread: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  unreadCount: 0,
  // Called by PusherProvider when conversation:new fires
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  // Called when user clicks the notification bell
  clearUnread: () => set({ unreadCount: 0 }),
}));
