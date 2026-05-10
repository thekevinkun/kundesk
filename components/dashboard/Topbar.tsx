"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useSidebarStore } from "@/stores/sidebar-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { fadeIn } from "@/lib/animations";
import { cn } from "@/lib/utils";

// ── Brand color presets — matches dashboard mockup ──
const COLOR_PRESETS = [
  { hex: "#069494", label: "Teal (Default)" },
  { hex: "#3b82f6", label: "Biru" },
  { hex: "#8b5cf6", label: "Ungu" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#ef4444", label: "Merah" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#06b6d4", label: "Cyan" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#14b8a6", label: "Teal Alt" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#84cc16", label: "Lime" },
  { hex: "#64748b", label: "Slate" },
];

const Topbar = () => {
  const { toggleMobile } = useSidebarStore();
  const [colorPanelOpen, setColorPanelOpen] = useState(false);
  const [activeColor, setActiveColor] = useState("#069494");

  // Apply brand color live by updating CSS variable on :root
  // In Phase 5 this will also save to chatbots.accentColor in DB
  const applyColor = (hex: string) => {
    document.documentElement.style.setProperty("--color-brand", hex);
    setActiveColor(hex);
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
          {/* Notification buttons */}
          {[
            { icon: "🔔", label: "Notifikasi", dot: "bg-red-500" },
            { icon: "💬", label: "Pesan", dot: "bg-blue-500" },
            { icon: "📦", label: "Update", dot: "bg-(--color-brand)" },
          ].map(({ icon, label, dot }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <button
                  className="relative w-[38px] h-[38px] rounded-[10px] bg-(--color-bg-page) border border-(--color-border) flex items-center justify-center text-base text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) transition-all"
                  aria-label={label}
                >
                  {icon}
                  {/* Notification dot */}
                  <span
                    className={cn(
                      "absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white",
                      dot,
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

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
                  className="absolute right-0 top-[calc(100%+10px)] bg-(--color-bg-card) border border-(--color-border) rounded-[14px] p-4 shadow-lg z-50 w-[220px]"
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
