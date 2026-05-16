// Shared state for live conversation and notification events received via Pusher
// Written by usePusherChannel, read by Topbar and NotificationPanel

import { create } from "zustand";
import type { NotificationItem } from "@/hooks/use-pusher-channel";

interface ConversationStore {
  // Unread notification count — badge on bell icon
  unreadCount: number;
  incrementUnread: () => void;
  clearUnread: () => void;

  // In-memory notification list — populated on panel open + live via Pusher
  notificationItems: NotificationItem[];
  setNotifications: (items: NotificationItem[]) => void;
  prependNotification: (item: NotificationItem) => void;
  markNotificationRead: (id: number) => void;
  markAllRead: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  unreadCount: 0,
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),

  notificationItems: [],
  // Called when panel opens — replaces list with fresh DB data
  setNotifications: (items) => set({ notificationItems: items }),
  // Called when Pusher fires notification:new — prepends to list live
  prependNotification: (item) =>
    set((state) => ({
      notificationItems: [
        item,
        // Deduplicate by id — StrictMode double-fires effects in dev
        ...state.notificationItems.filter((n) => n.id !== item.id),
      ].slice(0, 20),
    })),
  // Called when owner clicks a notification
  markNotificationRead: (id) =>
    set((state) => ({
      notificationItems: state.notificationItems.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    })),
  // Called when owner clicks "Tandai semua dibaca"
  markAllRead: () =>
    set((state) => ({
      notificationItems: state.notificationItems.map((n) => ({
        ...n,
        isRead: true,
      })),
      unreadCount: 0,
    })),
}));
