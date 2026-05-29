"use client";

import { useState, useEffect, useTransition } from "react";
import { useTheme } from "next-themes";
import { UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
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
import { NotificationPanel, GlobalSearch } from "@/components/dashboard";
import { COLOR_PRESETS } from "@/helpers/chatbot";
import { cn } from "@/lib/utils";
import { fadeIn, dropdownVariants } from "@/lib/animations";
import { saveAccentColor, getChatbotConfig } from "@/lib/actions/chatbot";
import {
  getLocalTimezone,
  formatLocalClock,
  formatUtcOffset,
} from "@/helpers/format";
import type { NotificationItem } from "@/hooks/use-pusher-channel";

const Topbar = () => {
  const {
    unreadCount,
    notificationItems,
    setNotifications,
    unreadConversationIds,
    hasPendingHandoff,
  } = useConversationStore();

  // Derive counts from store — no separate counters needed
  const unreadHumanCount = unreadConversationIds.size;

  // Show chat dot if anything needs attention
  const hasChatActivity = hasPendingHandoff || unreadHumanCount > 0;

  const { toggleMobile } = useSidebarStore();

  // Defer Clerk UserButton render until after hydration — prevents mismatch
  const [mounted, setMounted] = useState(false);

  // useTheme from next-themes — reads current theme, setTheme toggles .dark on <html>
  const { theme, setTheme } = useTheme();

  const [colorPanelOpen, setColorPanelOpen] = useState(false);
  const [activeColor, setActiveColor] = useState("#069494");
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [isTinyViewport, setIsTinyViewport] = useState(false);
  const [isCompactSearchOpen, setIsCompactSearchOpen] = useState(false);
  // useTransition — keeps UI responsive while Server Action runs in background
  const [, startTransition] = useTransition();

  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  // Live clock — update every second
  const [clock, setClock] = useState("");
  const [utcOffset, setUtcOffset] = useState("");

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

  useEffect(() => setMounted(true), []);

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
    const mediaQuery = window.matchMedia("(max-width: 549px)");

    const syncCompactSearch = () => {
      const matches = mediaQuery.matches;
      setIsTinyViewport(matches);
      if (!matches) {
        setIsCompactSearchOpen(false);
      }
    };

    syncCompactSearch();
    mediaQuery.addEventListener("change", syncCompactSearch);
    return () => mediaQuery.removeEventListener("change", syncCompactSearch);
  }, []);

  const compactSearchMode = isTinyViewport && isCompactSearchOpen;

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

  // Set timezone cookie on mount — read by dashboard/analytics Server Components
  // Uses IANA timezone name — e.g. "Asia/Makassar" for WITA
  useEffect(() => {
    const tz = getLocalTimezone();
    // SameSite=Lax — readable server-side, sent on navigation requests
    document.cookie = `tz=${encodeURIComponent(tz)}; path=/; SameSite=Lax; max-age=31536000`;
  }, []);

  // Live clock — updates every second using extracted helpers
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(formatLocalClock(now));
      setUtcOffset(formatUtcOffset(now));
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

        {/* Global search — conversations + documents */}
        <GlobalSearch
          compactMode={isTinyViewport}
          isExpanded={isCompactSearchOpen}
          onExpandedChange={setIsCompactSearchOpen}
        />

        <div className="ml-auto flex items-center gap-2 min-w-0">
          <AnimatePresence initial={false}>
            {!compactSearchMode && (
              <motion.div
                key="topbar-actions"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2"
              >
                {/* Bell icon */}
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (!isMobileLayout) {
                      setNotifPanelOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isMobileLayout) {
                      setNotifPanelOpen(false);
                    }
                  }}
                >
                  <button
                    onClick={() => {
                      setNotifPanelOpen((p) => !p);
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

                  <NotificationPanel
                    isOpen={notifPanelOpen}
                    onOpenChange={setNotifPanelOpen}
                  />
                </div>

                {/* Chat icon */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="relative w-[38px] h-[38px] rounded-[10px] bg-(--color-bg-page) 
                        border border-(--color-border) flex items-center justify-center text-base 
                        text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) 
                        transition-all"
                      aria-label={
                        hasPendingHandoff
                          ? "Ada pelanggan menunggu staff"
                          : unreadHumanCount > 0
                            ? `${unreadHumanCount} percakapan belum dibalas`
                            : "Pesan pelanggan"
                      }
                    >
                      💬
                      {/* Single brand dot — appears when anything needs attention */}
                      {hasChatActivity && (
                        <span
                          className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full 
                          border-2 border-white animate-pulse bg-(--color-brand)"
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {/* Show both lines when both conditions are true */}
                    {!hasChatActivity && <span>Pesan pelanggan</span>}
                    {hasPendingHandoff && (
                      <div>Ada pelanggan menunggu staff</div>
                    )}
                    {unreadHumanCount > 0 && (
                      <div>{unreadHumanCount} percakapan belum dibalas</div>
                    )}
                  </TooltipContent>
                </Tooltip>

                <Separator
                  orientation="vertical"
                  className="h-7! bg-(--color-border)!"
                />

                {/* Dark mode toggle — sun in dark mode, moon in light mode */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                      }
                      className="w-[38px] h-[38px] rounded-[10px] bg-(--color-bg-page) border border-(--color-border) flex items-center justify-center text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) transition-all"
                      aria-label={
                        theme === "dark"
                          ? "Aktifkan mode terang"
                          : "Aktifkan mode gelap"
                      }
                    >
                      {theme === "dark" ? (
                        // Sun icon — shown in dark mode, click to go light
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="5" />
                          <line x1="12" y1="1" x2="12" y2="3" />
                          <line x1="12" y1="21" x2="12" y2="23" />
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                          <line x1="1" y1="12" x2="3" y2="12" />
                          <line x1="21" y1="12" x2="23" y2="12" />
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                      ) : (
                        // Moon icon — shown in light mode, click to go dark
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {theme === "dark" ? "Mode terang" : "Mode gelap"}
                  </TooltipContent>
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
                  className="h-7! bg-(--color-border)!"
                />

                {/* WIB/WITA/WIT clock — live, updates every second, uses device timezone */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      aria-label={`Waktu lokal: ${clock} ${utcOffset}`}
                      className="hidden md:flex items-center gap-1.5 px-3 py-[7px] bg-(--color-bg-page) 
                        border border-(--color-border) rounded-full"
                    >
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clerk UserButton — handles sign out, profile */}
          {mounted && (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "!w-[28px] !h-[28px]",
                },
              }}
            />
          )}
        </div>
      </motion.header>
    </TooltipProvider>
  );
};

export default Topbar;
