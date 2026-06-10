"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { fadeIn, slideInLeft } from "@/lib/animations";
import { SidebarContent } from "./sidebar";
import type { SubscriptionStatus } from "@/types/billing";

interface SidebarProps {
  subscriptionStatus: SubscriptionStatus;
}

const Sidebar = ({ subscriptionStatus }: SidebarProps) => {
  const { mobileOpen, closeMobile } = useSidebarStore();

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar — fixed, always visible on lg+ */}
      <motion.aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-dvh w-3/4 lg:w-[230px]
          bg-(--color-bg-card) border-r border-(--color-border) z-50"
        variants={slideInLeft}
        initial="hidden"
        animate="visible"
      >
        <SidebarContent subscriptionStatus={subscriptionStatus} />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-0 z-70 bg-black/40"
              onClick={closeMobile}
            />

            <div className="fixed inset-0 z-80">
              <motion.aside
                variants={slideInLeft}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="fixed inset-y-0 left-0 flex h-[100svh] min-h-[100svh] w-3/4 flex-col overflow-hidden
                  bg-(--color-bg-card) border-r border-(--color-border) shadow-lg"
              >
                <button
                  type="button"
                  onClick={closeMobile}
                  className="absolute top-3 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden"
                  aria-label="Tutup navigasi"
                >
                  <XIcon className="size-5" />
                </button>
                <SidebarContent
                  onNavClick={closeMobile}
                  subscriptionStatus={subscriptionStatus}
                />
              </motion.aside>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
