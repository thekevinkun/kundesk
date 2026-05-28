"use client";

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { XIcon } from "lucide-react";
import { useConversationStore } from "@/stores/conversation-store";
import { formatRelativeTime } from "@/helpers/format";
import { dropdownVariants, fadeIn, slideInRight } from "@/lib/animations";
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
  onOpenChange: (open: boolean) => void;
}

const NotificationPanel = ({ isOpen, onOpenChange }: NotificationPanelProps) => {
  const { orgId } = useAuth();
  const [isMobileLayout, setIsMobileLayout] = useState(false);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");

    const syncLayout = () => {
      setIsMobileLayout(mediaQuery.matches);
    };

    syncLayout();

    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    if (!isOpen || !isMobileLayout) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isMobileLayout]);

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

  const panelBody = (
    <div className="flex h-dvh lg:h-full flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 pr-12 lg:pr-7 border-b border-(--color-border-sm)">
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
      <div className="max-h-full lg:max-h-[400px] flex-1 overflow-y-auto">
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
                        ? "font-bold text-(--color-text-900) dark:!text-black/80"
                        : "font-medium text-(--color-text-700)"
                    }`}
                  >
                    {notif.title}
                  </div>

                  {(() => {
                    const [sessionPart, messagePart] = (notif.body ?? "").split(
                      "|",
                    );
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
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen &&
        (isMobileLayout ? (
          <>
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-0 z-70 bg-black/40"
              onClick={() => onOpenChange(false)}
            />
            <motion.aside
              variants={slideInRight}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-y-0 right-0 z-80 flex h-dvh w-3/4 max-w-sm flex-col 
                bg-(--color-bg-card) border-r border-(--color-border) shadow-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden"
                aria-label="Tutup notifikasi"
              >
                <XIcon className="size-4" />
              </button>
              {panelBody}
            </motion.aside>
          </>
        ) : (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute lg:right-0 top-[calc(100%+3px)] w-[360px] 
              bg-(--color-bg-card) border border-(--color-border) rounded-[16px] 
              shadow-lg z-80 overflow-hidden"
          >
            {panelBody}
          </motion.div>
        ))}
    </AnimatePresence>
  );
};

export default NotificationPanel;
