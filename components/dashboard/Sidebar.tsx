"use client";

import { motion } from "framer-motion";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Sheet, SheetTitle, SheetContent } from "@/components/ui/sheet";
import { useSidebarStore } from "@/stores/sidebar-store";
import { slideInLeft } from "@/lib/animations";
import { SidebarContent } from "./sidebar";
import type { SubscriptionStatus } from "@/types/billing";

interface SidebarProps {
  subscriptionStatus: SubscriptionStatus;
}

const Sidebar = ({ subscriptionStatus }: SidebarProps) => {
  const { mobileOpen, closeMobile } = useSidebarStore();

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

      {/* Mobile sidebar — Sheet drawer, triggered by topbar hamburger */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && closeMobile()}>
        <VisuallyHidden>
          <SheetTitle>Navigation Menu</SheetTitle>
        </VisuallyHidden>

        <SheetContent
          side="left"
          className="p-0 bg-(--color-bg-card) border-r border-(--color-border)"
        >
          <SidebarContent
            onNavClick={closeMobile}
            subscriptionStatus={subscriptionStatus}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Sidebar;
