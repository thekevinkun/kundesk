"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useSidebarStore } from "@/stores/sidebar-store";
import { ConversationCountBadge, DocCountBadge } from "@/components/dashboard";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { slideInLeft, staggerContainer, staggerItem } from "@/lib/animations";
import type { SubscriptionStatus } from "@/types/billing";

// ── Nav item type ──
interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: { text: string; variant: "brand" | "red" | "gray" };
}

// ── Nav sections ──
const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "🏠" },
      { href: "/dashboard/conversations", label: "Percakapan", icon: "💬" },
      {
        href: "/dashboard/analytics",
        label: "Analytics",
        icon: "📊",
        badge: { text: "Live", variant: "brand" },
      },
    ],
  },
  {
    label: "Chatbot",
    items: [
      { href: "/dashboard/chatbot", label: "Konfigurasi", icon: "⚙️" },
      { href: "/dashboard/documents", label: "Dokumen", icon: "📄" },
      { href: "/dashboard/widget", label: "Widget Embed", icon: "🔗" },
    ],
  },
  {
    label: "Akun",
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: "💳" },
      { href: "/dashboard/settings", label: "Pengaturan", icon: "🛡️" },
      { href: "/dashboard/team", label: "Tim", icon: "👥" },
    ],
  },
];

// ── Badge variants ──
const badgeClass: Record<string, string> = {
  brand: "bg-(--color-brand-light) text-(--color-brand)",
  red: "bg-red-100 text-red-500",
  gray: "bg-(--color-bg-page) text-(--color-text-400) border border-(--color-border)",
};

// ── Single nav item ──
const NavItemRow = ({
  item,
  onClick,
  subscriptionStatus,
}: {
  item: NavItem;
  onClick?: (() => void) | undefined;
  subscriptionStatus: SubscriptionStatus;
}) => {
  const pathname = usePathname();

  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Billing badge — amber warning when past_due or suspended
  // Rendered only on the billing nav item, only when action is needed
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
      {/* Active indicator bar */}
      {isActive && (
        <motion.div
          layoutId="active-nav-bar"
          className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-(--color-brand) rounded-r-full -ml-3"
        />
      )}

      {/* Icon background */}
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

      {/* Static badge from nav config — e.g. "Live" on Analytics */}
      {item.badge && !showBillingWarning && (
        <span
          className={cn(
            "text-[10.5px] font-bold min-w-5 h-5 rounded-full flex items-center justify-center px-1.5",
            badgeClass[item.badge.variant],
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

      {/* Live pending handoff badge */}
      {item.href === "/dashboard/conversations" && <ConversationCountBadge />}

      {/* Live document count badge */}
      {item.href === "/dashboard/documents" && <DocCountBadge />}
    </Link>
  );
};

// ── Sidebar content — shared between desktop and mobile drawer ──
const SidebarContent = ({
  onNavClick,
  subscriptionStatus,
}: {
  onNavClick?: () => void;
  subscriptionStatus: SubscriptionStatus;
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Logo + Org Switcher */}
      <div className="px-6 py-5 border-b border-(--color-border) flex-shrink-0">
        <div className="text-[22px] font-extrabold tracking-[-0.04em] leading-none mb-3">
          <span className="text-(--color-text-900)">Kun</span>
          <span className="text-(--color-brand)">desk</span>
        </div>
        <div className="text-[11px] text-(--color-text-400) mb-3">
          AI Customer Service
        </div>
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger:
                "w-full justify-start px-2 py-1.5 rounded-[10px] border border-(--color-border) bg-(--color-bg-page) hover:bg-(--color-bg-card) text-sm font-medium text-(--color-text-700) transition-all",
            },
          }}
        />
      </div>

      {/* Nav sections */}
      <motion.nav
        className="flex-1 px-3 py-4 overflow-y-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        aria-label="Dashboard navigation"
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-(--color-text-400) px-2.5 mb-1">
              {section.label}
            </div>
            <motion.div
              variants={staggerContainer}
              className="flex flex-col gap-0.5"
            >
              {section.items.map((item) => (
                <motion.div key={item.href} variants={staggerItem}>
                  <NavItemRow
                    item={item}
                    onClick={onNavClick}
                    subscriptionStatus={subscriptionStatus}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        ))}
      </motion.nav>

      <Separator className="bg-(--color-border)" />

      {/* Sidebar CTA card */}
      <div className="p-3 flex-shrink-0">
        <div
          className="relative overflow-hidden rounded-[14px] p-[18px]"
          style={{
            background:
              "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
          }}
        >
          <div className="absolute -right-5 -top-5 w-[90px] h-[90px] rounded-full bg-white/10" />
          <div className="absolute right-2.5 -bottom-8 w-[70px] h-[70px] rounded-full bg-white/7" />

          <span className="text-[28px] mb-2 block" aria-hidden="true">
            🚀
          </span>
          <div className="text-[13px] font-bold text-white mb-1">
            Upgrade ke Pro
          </div>
          <div className="text-[11.5px] text-white/80 mb-3.5 leading-relaxed">
            Unlimited dokumen & 10,000 pesan per bulan
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-block bg-white text-[12px] font-bold px-4 py-2 rounded-full transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{ color: "var(--color-brand-dark)" }}
          >
            Lihat Plan
          </Link>
        </div>
      </div>
    </div>
  );
};

// ── Main export ──
interface SidebarProps {
  subscriptionStatus: SubscriptionStatus;
}

const Sidebar = ({ subscriptionStatus }: SidebarProps) => {
  const { mobileOpen, closeMobile } = useSidebarStore();

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-[230px] bg-(--color-bg-card) border-r border-(--color-border) z-50"
        variants={slideInLeft}
        initial="hidden"
        animate="visible"
      >
        <SidebarContent subscriptionStatus={subscriptionStatus} />
      </motion.aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && closeMobile()}>
        <SheetContent
          side="left"
          className="p-0 w-[230px] bg-(--color-bg-card) border-r border-(--color-border)"
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
