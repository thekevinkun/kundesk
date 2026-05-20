"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { useConversationStore } from "@/stores/conversation-store";
import { formatRelativeTime } from "@/helpers/format";
import { dropdownVariants } from "@/lib/animations";
import type { NotificationItem } from "@/hooks/use-pusher-channel";

// Icon per notification type
const notifIcon = (type: string): string => {
  if (type === "conversation_new") return "💬";
  if (type === "conversation_takeover") return "🙋";
  if (type === "conversation_return") return "🤖";
  if (type === "message_new") return "✉️";
  if (type === "handoff_message") return "✍️";
  return "🔔";
};

interface NotificationPanelProps {
  isOpen: boolean;
}

const NotificationPanel = ({ isOpen }: NotificationPanelProps) => {
  const { orgId } = useAuth();

  const {
    notificationItems,
    setNotifications,
    markNotificationRead,
    markAllRead,
    clearUnread,
  } = useConversationStore();

  // Fetch notifications from DB when panel opens — don't auto-mark as read
  useEffect(() => {
    // Wait for Clerk to hydrate — orgId is null briefly on first render
    if (!isOpen || !orgId) return;

    const load = async () => {
      try {
        const res = await fetch("/api/notifications");
        const json = (await res.json()) as {
          ok: boolean;
          data: NotificationItem[];
        };
        if (json.ok) setNotifications(json.data);
      } catch {
        console.error("[NotificationPanel] Failed to fetch notifications");
      }
    };

    void load();
    // Bell badge clears when panel opens — user is aware of notifications now
    clearUnread();
  }, [isOpen, orgId, setNotifications, clearUnread]);

  // Mark single notification as read
  const handleNotifClick = useCallback(
    (notif: NotificationItem) => {
      if (!notif.isRead) {
        markNotificationRead(notif.id);
        fetch(`/api/notifications/${notif.id}/read`, {
          method: "PATCH",
        }).catch(console.error);
      }
    },
    [markNotificationRead],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={dropdownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute right-0 top-[calc(100%+10px)] w-[360px] 
            bg-(--color-bg-card) border border-(--color-border) rounded-[16px] 
            shadow-lg z-80 overflow-hidden"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border-sm)">
            <div className="text-[13px] font-bold text-(--color-text-900)">
              Notifikasi
            </div>
            <div className="flex items-center gap-2">
              {notificationItems.some((n) => !n.isRead) && (
                <button
                  onClick={() => {
                    markAllRead();
                    fetch("/api/notifications/read-all", {
                      method: "PATCH",
                    }).catch(console.error);
                  }}
                  className="text-[11.5px] font-semibold text-(--color-brand) hover:underline"
                >
                  Tandai semua dibaca
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {notificationItems.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <div className="text-[13px] font-semibold text-(--color-text-500)">
                  Belum ada notifikasi
                </div>
                <div className="text-[11.5px] text-(--color-text-400) mt-1">
                  Notifikasi akan muncul saat ada percakapan baru
                </div>
              </div>
            ) : (
              <div>
                {notificationItems.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={`w-full flex items-start gap-3 px-4 py-3 border-b border-(--color-border-sm) last:border-0 hover:bg-(--color-bg-page) transition-colors text-left ${
                      !notif.isRead ? "bg-(--color-brand-light)" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[15px] flex-shrink-0 mt-0.5 ${
                        !notif.isRead
                          ? "bg-(--color-brand-mid)"
                          : "bg-(--color-bg-page)"
                      }`}
                    >
                      {notifIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[13px] leading-snug ${
                          !notif.isRead
                            ? "font-bold text-(--color-text-900)"
                            : "font-medium text-(--color-text-700)"
                        }`}
                      >
                        {notif.title}
                      </div>

                      {(() => {
                        const [sessionPart, messagePart] = (
                          notif.body ?? ""
                        ).split("|");
                        return (
                          <>
                            {messagePart && (
                              <div className="text-[11.5px] text-(--color-text-500) mt-0.5 truncate">
                                {messagePart}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-[11px] text-(--color-text-400)">
                                {formatRelativeTime(notif.createdAt)}
                              </div>
                              {sessionPart && (
                                <div className="text-[11px] font-mono text-(--color-text-400)">
                                  Sesi #{sessionPart}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notificationItems.length > 0 && (
            <div className="px-4 py-2.5 border-t border-(--color-border-sm) text-center">
              <span className="text-[11.5px] text-(--color-text-400)">
                Menampilkan {notificationItems.length} notifikasi terakhir
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;
