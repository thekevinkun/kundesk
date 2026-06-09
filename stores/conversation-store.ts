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

  // ── Usage — live-updated from usage:updated Pusher event ──
  messagesUsed: number | null;
  messagesLimit: number | null;
  setUsage: (used: number, limit: number) => void;

  // ── Accent color — customizable via Appearance settings ──
  accentColor: string;
  setAccentColor: (color: string) => void;

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

  // Usage
  messagesUsed: null,
  messagesLimit: null,
  setUsage: (used, limit) => set({ messagesUsed: used, messagesLimit: limit }),

  // Accent color
  accentColor: "#069494",
  setAccentColor: (color) => set({ accentColor: color }),

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
