"use client";

import { useState, useEffect, useTransition } from "react";
import { UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useConversationStore } from "@/stores/conversation-store";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { NotificationPanel } from "@/components/dashboard";
import { COLOR_PRESETS } from "@/helpers/chatbot";
import { cn } from "@/lib/utils";
import { fadeIn, dropdownVariants } from "@/lib/animations";
import { saveAccentColor, getChatbotConfig } from "@/lib/actions/chatbot";
import type { NotificationItem } from "@/hooks/use-pusher-channel";

const Topbar = () => {
  const { unreadCount, clearUnread, notificationItems, setNotifications } =
    useConversationStore();
  const { toggleMobile } = useSidebarStore();
  const [colorPanelOpen, setColorPanelOpen] = useState(false);
  const [activeColor, setActiveColor] = useState("#069494");
  // useTransition — keeps UI responsive while Server Action runs in background
  const [, startTransition] = useTransition();

  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  // Live clock — update every second
  const [clock, setClock] = useState("");
  const [utcOffset, setUtcOffset] = useState("");

  // Fetch unread count on mount — persists red dot across page refreshes
  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await fetch("/api/notifications");
        const json = (await res.json()) as {
          ok: boolean;
          data: NotificationItem[];
        };
        if (json.ok) setNotifications(json.data);
      } catch {
        // Non-critical — dot just won't show on refresh
      }
    };
    void loadUnread();
  }, [setNotifications]);

  useEffect(() => {
    const update = () => {
      const now = new Date();

      // Device local time — no hardcoded timezone
      setClock(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );

      // UTC offset — e.g. "UTC+8" for WITA, "UTC+7" for WIB, "UTC+9" for WIT
      const offsetMinutes = -now.getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
      const offsetMins = Math.abs(offsetMinutes) % 60;
      const sign = offsetMinutes >= 0 ? "+" : "-";
      setUtcOffset(
        offsetMins > 0
          ? `UTC${sign}${offsetHours}:${String(offsetMins).padStart(2, "0")}`
          : `UTC${sign}${offsetHours}`,
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // On mount — read the saved accent color from the CSS variable
  // The chatbot config page sets this via Server Action + revalidatePath
  // BotStatusPanel passes accentColor to DashboardOverview which applies it on load
  // We read from CSS variable so Topbar stays in sync without an extra fetch
  useEffect(() => {
    // Fetch saved accent color from DB on mount — source of truth
    // Avoids race condition with DashboardOverview's useEffect
    const loadColor = async () => {
      try {
        const config = await getChatbotConfig();
        if (config?.accentColor) {
          setActiveColor(config.accentColor);
          document.documentElement.style.setProperty(
            "--color-brand",
            config.accentColor,
          );
        }
      } catch (error) {
        console.error("Failed to load accent color:", error);
        toast.error("Gagal memuat warna brand");
      }
    };
    void loadColor();
  }, []);

  // Apply color live + persist to DB via Server Action
  const applyColor = (hex: string) => {
    // Update CSS variable immediately — no wait for server
    document.documentElement.style.setProperty("--color-brand", hex);
    setActiveColor(hex);

    // Persist in background — useTransition keeps UI non-blocking
    startTransition(() => {
      void saveAccentColor(hex);
    });
  };

  return (
    <TooltipProvider>
      <motion.header
        className="h-[68px] bg-(--color-bg-card) border-b border-(--color-border) flex items-center gap-4 px-4 md:px-7 sticky top-0 z-40 flex-shrink-0"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
      >
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleMobile}
          className="lg:hidden w-9 h-9 rounded-[10px] bg-(--color-bg-page) border border-(--color-border) flex items-center justify-center text-base text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) transition-all"
          aria-label="Buka menu navigasi"
        >
          ☰
        </button>

        {/* Search */}
        <div className="flex-1 max-w-[400px] relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-400) text-sm">
            🔍
          </span>
          <input
            type="search"
            placeholder="Cari percakapan, dokumen..."
            className="w-full bg-(--color-bg-page) border border-(--color-border) rounded-full py-2 pl-9 pr-4 text-[13px] text-(--color-text-700) placeholder:text-(--color-text-400) outline-none focus:border-(--color-brand) focus:bg-(--color-bg-card) focus:ring-2 focus:ring-(--color-brand-light) transition-all"
          />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Bell icon — hover on desktop, click on mobile */}
          <div
            className="relative"
            onMouseEnter={() => {
              // Only use hover on non-touch devices
              if (!window.matchMedia("(hover: none)").matches) {
                setNotifPanelOpen(true);
              }
            }}
            onMouseLeave={() => {
              if (!window.matchMedia("(hover: none)").matches) {
                setNotifPanelOpen(false);
              }
            }}
          >
            <button
              onClick={() => {
                // On touch devices, toggle on click
                if (window.matchMedia("(hover: none)").matches) {
                  setNotifPanelOpen((p) => !p);
                }
              }}
              className="relative w-[38px] h-[38px] rounded-[10px] bg-(--color-bg-page) 
                border border-(--color-border) flex items-center justify-center text-base 
                text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) 
                transition-all"
              aria-label="Notifikasi"
              aria-expanded={notifPanelOpen}
            >
              🔔
              {(unreadCount > 0 ||
                notificationItems.some((n) => !n.isRead)) && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse bg-red-500" />
              )}
            </button>

            <NotificationPanel isOpen={notifPanelOpen} />
          </div>

          {/* Chat icon — new conversation counter, no panel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={clearUnread}
                className="relative w-[38px] h-[38px] rounded-[10px] bg-(--color-bg-page) 
                  border border-(--color-border) flex items-center justify-center text-base 
                  text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) 
                  transition-all"
                aria-label="Percakapan baru"
              >
                💬
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse bg-(--color-brand)" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Percakapan baru</TooltipContent>
          </Tooltip>

          {/* Color picker */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setColorPanelOpen((p) => !p)}
                  className="flex items-center gap-2 px-3 py-[7px] bg-(--color-bg-page) border border-(--color-border) rounded-full text-[12px] font-semibold text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) transition-all"
                  aria-label="Pilih warna brand"
                  aria-expanded={colorPanelOpen}
                >
                  {/* Live color swatch */}
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ background: activeColor }}
                  />
                  <span className="hidden sm:block">Warna Brand</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Ubah warna brand</TooltipContent>
            </Tooltip>

            {/* Color panel dropdown */}
            {colorPanelOpen && (
              <>
                {/* Click outside to close */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setColorPanelOpen(false)}
                />
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute right-0 top-[calc(100%+10px)] bg-(--color-bg-card) border border-(--color-border) rounded-[14px] p-4 shadow-lg z-50 w-[220px]"
                >
                  <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400) mb-3">
                    Pilih Warna Brand
                  </div>

                  {/* Color presets grid */}
                  <div className="grid grid-cols-6 gap-1.5 mb-3">
                    {COLOR_PRESETS.map(({ hex, label }) => (
                      <Tooltip key={hex}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              applyColor(hex);
                              setColorPanelOpen(false);
                            }}
                            className={cn(
                              "w-7 h-7 rounded-[7px] transition-transform hover:scale-110 border-2",
                              activeColor === hex
                                ? "border-(--color-text-900)"
                                : "border-transparent",
                            )}
                            style={{ background: hex }}
                            aria-label={label}
                          />
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>

                  {/* Custom hex input */}
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-(--color-text-500) whitespace-nowrap">
                      Custom:
                    </label>
                    <input
                      type="color"
                      value={activeColor}
                      onChange={(e) => applyColor(e.target.value)}
                      className="w-9 h-7 rounded-[7px] border border-(--color-border) p-0.5 cursor-pointer bg-transparent"
                      aria-label="Pilih warna custom"
                    />
                  </div>
                </motion.div>
              </>
            )}
          </div>

          <Separator
            orientation="vertical"
            className="h-7 bg-(--color-border)"
          />

          {/* WIB/WITA/WIT clock — live, updates every second, uses device timezone */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden md:flex items-center gap-1.5 px-3 py-[7px] bg-(--color-bg-page) border border-(--color-border) rounded-full">
                <span className="text-[11px]" aria-hidden="true">
                  🕐
                </span>
                <span
                  className="font-mono text-[12px] font-semibold text-(--color-text-700) tabular-nums"
                  suppressHydrationWarning
                >
                  {clock}
                </span>
                <span
                  className="text-[10px] font-semibold text-(--color-text-400)"
                  suppressHydrationWarning
                >
                  {utcOffset}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Waktu lokal perangkat kamu</TooltipContent>
          </Tooltip>

          <Separator
            orientation="vertical"
            className="h-7 bg-(--color-border)"
          />

          {/* Clerk UserButton — handles sign out, profile */}
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-[30px] h-[30px]",
              },
            }}
          />
        </div>
      </motion.header>
    </TooltipProvider>
  );
};

export default Topbar;
