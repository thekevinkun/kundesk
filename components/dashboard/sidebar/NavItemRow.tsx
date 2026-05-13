"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ConversationCountBadge,
  DocCountBadge,
} from "@/components/dashboard/badge";
import { BADGE_CLASS } from "./constants";
import type { NavItem } from "./constants";
import type { SubscriptionStatus } from "@/types/billing";

interface NavItemRowProps {
  item: NavItem;
  onClick?: (() => void) | undefined;
  subscriptionStatus: SubscriptionStatus;
}

const NavItemRow = ({ item, onClick, subscriptionStatus }: NavItemRowProps) => {
  const pathname = usePathname();

  // Exact match for dashboard root, prefix match for nested routes
  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Billing warning — only on billing nav item, only when action needed
  const showBillingWarning =
    item.href === "/dashboard/billing" &&
    (subscriptionStatus === "past_due" || subscriptionStatus === "suspended");

  const billingWarningAriaLabel =
    subscriptionStatus === "suspended"
      ? "Tindakan diperlukan — akun disuspend"
      : "Tindakan diperlukan — tagihan jatuh tempo";

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      {...(onClick ? { onClick } : {})}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13.5px] font-medium transition-all duration-150 relative group",
        isActive
          ? "bg-(--color-brand-light) text-(--color-brand) font-semibold"
          : "text-(--color-text-500) hover:bg-(--color-bg-page) hover:text-(--color-text-900)",
      )}
    >
      {/* Active indicator bar on left edge */}
      {isActive && (
        <motion.div
          layoutId="active-nav-bar"
          className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-(--color-brand) rounded-r-full -ml-3"
        />
      )}

      {/* Icon background — teal tint when active */}
      <div
        className={cn(
          "w-8 h-8 rounded-[7px] flex items-center justify-center text-base flex-shrink-0 transition-colors",
          isActive ? "bg-(--color-brand-mid)" : "bg-(--color-bg-page)",
        )}
      >
        {item.icon}
      </div>

      {/* Label */}
      <span className="flex-1">{item.label}</span>

      {/* Static badge — e.g. "Live" on Analytics, hidden when billing warning shows */}
      {item.badge && !showBillingWarning && (
        <span
          className={cn(
            "text-[10.5px] font-bold min-w-5 h-5 rounded-full flex items-center justify-center px-1.5",
            BADGE_CLASS[item.badge.variant],
          )}
        >
          {item.badge.text}
        </span>
      )}

      {/* Billing warning badge — amber ⚠ when past_due or suspended */}
      {showBillingWarning && (
        <span
          className="text-[10.5px] font-bold min-w-5 h-5 rounded-full flex items-center justify-center px-1.5 bg-(--color-warning-bg) text-(--color-warning)"
          aria-label={billingWarningAriaLabel}
        >
          ⚠
        </span>
      )}

      {/* Live pending handoff badge — red, only shows when count > 0 */}
      {item.href === "/dashboard/conversations" && <ConversationCountBadge />}

      {/* Live document count badge */}
      {item.href === "/dashboard/documents" && <DocCountBadge />}
    </Link>
  );
};

export default NavItemRow;
