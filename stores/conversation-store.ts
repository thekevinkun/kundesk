// Shared state for live conversation and notification events received via Pusher
// Written by usePusherChannel, read by Topbar and NotificationPanel

import { create } from "zustand";
import type { NotificationItem } from "@/hooks/use-pusher-channel";

interface ConversationStore {
  // ── Bell icon counter — notifications only (new convo, takeover, return) ──
  unreadCount: number;
  incrementUnread: () => void;
  clearUnread: () => void;

  // ── Pending handoff flag — drives red dot on chat icon ──
  // Set when any conversation enters pending_handoff, cleared when that row is clicked
  hasPendingHandoff: boolean;
  setPendingHandoff: (value: boolean) => void;
  // ── Unread conversation IDs — drives the dot on ConversationRow ──
  // Added when customer sends message in human mode, cleared when row is expanded
  unreadConversationIds: Set<number>;
  addUnreadConversation: (id: number) => void;
  clearUnreadConversation: (id: number) => void;

  // ── In-memory notification list — bell panel ──
  notificationItems: NotificationItem[];
  setNotifications: (items: NotificationItem[]) => void;
  prependNotification: (item: NotificationItem) => void;
  markNotificationRead: (id: number) => void;
  markAllRead: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  // Bell
  unreadCount: 0,
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),

  // Pending handoff flag — red dot on chat icon
  hasPendingHandoff: false,
  setPendingHandoff: (value) => set({ hasPendingHandoff: value }),

  // Unread conversation IDs — row dot indicator
  unreadConversationIds: new Set<number>(),
  addUnreadConversation: (id) =>
    set((state) => ({
      // Set is immutable in Zustand — must create new Set
      unreadConversationIds: new Set([...state.unreadConversationIds, id]),
    })),
  clearUnreadConversation: (id) =>
    set((state) => {
      const next = new Set(state.unreadConversationIds);
      next.delete(id);
      return { unreadConversationIds: next };
    }),

  // Bell panel notifications
  notificationItems: [],
  setNotifications: (items) => set({ notificationItems: items }),
  prependNotification: (item) =>
    set((state) => ({
      notificationItems: [
        item,
        ...state.notificationItems.filter((n) => n.id !== item.id),
      ].slice(0, 20),
    })),
  markNotificationRead: (id) =>
    set((state) => ({
      notificationItems: state.notificationItems.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      notificationItems: state.notificationItems.map((n) => ({
        ...n,
        isRead: true,
      })),
      unreadCount: 0,
    })),
}));
