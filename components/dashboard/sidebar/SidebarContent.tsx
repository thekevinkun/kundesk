"use client";

import Link from "next/link";
import Image from "next/image";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { NAV_SECTIONS } from "./constants";
import NavItemRow from "./NavItemRow";
import type { SubscriptionStatus } from "@/types/billing";

interface SidebarContentProps {
  onNavClick?: () => void;
  subscriptionStatus: SubscriptionStatus;
}

const SidebarContent = ({
  onNavClick,
  subscriptionStatus,
}: SidebarContentProps) => {
  return (
    <div className="flex flex-col h-full">
      {/* ── Logo + Org Switcher ── */}
      <div className="px-6 py-5 border-b border-(--color-border) flex-shrink-0">
        <div className="mb-3">
          <Image
            src="/images/logo_kundesk.png"
            alt="Kundesk"
            width={132}
            height={40}
            className="w-33 h-10 object-contain"
            priority
          />
        </div>
        <div className="text-[11px] text-(--color-text-400) mb-3">
          AI Customer Service
        </div>
        {/* Clerk org switcher — lets owner switch between orgs */}
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

      {/* ── Nav sections ── */}
      <motion.nav
        className="flex-1 px-3 py-4 overflow-y-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        aria-label="Dashboard navigation"
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {/* Section label */}
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

      {/* ── CTA card — upgrade prompt ── */}
      <div className="p-3 flex-shrink-0">
        <div
          className="relative overflow-hidden rounded-[14px] p-[18px]"
          style={{
            background:
              "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
          }}
        >
          {/* Decorative circles */}
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

export default SidebarContent;
