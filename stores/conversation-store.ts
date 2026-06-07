// Shared state for live conversation and notification events received via Pusher
// Written by usePusherChannel, read by Topbar and NotificationPanel

import { create } from "zustand";
import type { NotificationItem } from "@/hooks/use-pusher-channel";

const UNREAD_STORAGE_PREFIX = "kundesk:unread-conversations:"; // One browser key per org.

const getUnreadStorageKey = (orgId: string) =>
  `${UNREAD_STORAGE_PREFIX}${orgId}`; // Build the org-scoped storage key.

const readUnreadConversationIds = (orgId: string) => {
  // Load unread IDs from browser storage.
  if (typeof window === "undefined") return new Set<number>(); // Server render has no window.
  try {
    // Guard against malformed storage values.
    const raw = window.localStorage.getItem(getUnreadStorageKey(orgId)); // Read the org-specific payload.
    if (!raw) return new Set<number>(); // Missing storage means no unread conversations yet.
    const parsed = JSON.parse(raw) as unknown; // Parse the persisted array safely.
    if (!Array.isArray(parsed)) return new Set<number>(); // Ignore anything that is not an array.
    return new Set( // Rebuild the Set so lookup stays O(1).
      parsed.filter((id): id is number => typeof id === "number"), // Keep only numeric conversation IDs.
    );
  } catch {
    // Corrupt storage should not break the dashboard.
    return new Set<number>(); // Fall back to an empty unread set.
  }
};

const writeUnreadConversationIds = (orgId: string, ids: Set<number>) => {
  // Persist unread IDs for the current org.
  if (typeof window === "undefined") return; // Skip browser storage during server render.
  try {
    // Storage can fail in private mode or quota pressure.
    window.localStorage.setItem(
      // Save the latest unread snapshot.
      getUnreadStorageKey(orgId), // Keep data isolated per org.
      JSON.stringify([...ids]), // Store a plain array so it survives refresh.
    );
  } catch {
    // Persistence is best-effort only.
    void 0; // Ignore storage write failures so the UI still works.
  }
};

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
  activeOrgId: string | null;
  hydrateUnreadConversationIds: (orgId: string) => void;
  unreadConversationIds: Set<number>;
  addUnreadConversation: (id: number) => void;
  clearUnreadConversation: (id: number) => void;

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

  // Active org scope — unread state is persisted per org.
  activeOrgId: null,
  hydrateUnreadConversationIds: (orgId) =>
    set({
      activeOrgId: orgId,
      unreadConversationIds: readUnreadConversationIds(orgId),
      unreadCount: 0,
      hasPendingHandoff: false,
      notificationItems: [],
    }),

  // Unread conversation IDs — row dot indicator
  unreadConversationIds: new Set<number>(),
  addUnreadConversation: (id) =>
    set((state) => {
      const next = new Set(state.unreadConversationIds); // Clone the Set before mutating it.
      next.add(id); // Mark this conversation as unread in the current org.
      if (state.activeOrgId)
        writeUnreadConversationIds(state.activeOrgId, next); // Persist the new unread snapshot.
      return { unreadConversationIds: next }; // Commit the updated Set to Zustand.
    }),
  clearUnreadConversation: (id) =>
    set((state) => {
      const next = new Set(state.unreadConversationIds); // Clone the Set before removing an item.
      next.delete(id); // Mark this conversation as read for the current org.
      if (state.activeOrgId)
        writeUnreadConversationIds(state.activeOrgId, next); // Persist the cleared unread snapshot.
      return { unreadConversationIds: next }; // Commit the updated Set to Zustand.
    }),

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
