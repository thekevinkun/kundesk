"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { KPI_CARDS } from "./constants";

interface AnalyticsKpiStripProps {
  totalConversations: number;
  resolutionRate: number;
  handoffRate: number;
  avgResponseTime: string | null;
}

const AnalyticsKpiStrip = ({
  totalConversations,
  resolutionRate,
  handoffRate,
  avgResponseTime,
}: AnalyticsKpiStripProps) => {
  // Runtime values — matched to KPI_CARDS keys
  const values: Record<string, string> = {
    totalConversations: totalConversations.toLocaleString("id-ID"),
    resolutionRate: `${resolutionRate}`,
    handoffRate: `${handoffRate}`,
    avgResponseTime: avgResponseTime ?? "—",
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-4 gap-4"
    >
      {KPI_CARDS.map((card) => (
        <motion.div
          key={card.key}
          variants={staggerItem}
          className="card-base p-5 flex items-center gap-4"
        >
          {/* Colored icon background — same 3D-style as dashboard stat cards */}
          <div
            className={`w-12 h-12 rounded-[14px] flex items-center justify-center text-[22px] flex-shrink-0 ${card.iconBg}`}
          >
            {card.icon}
          </div>

          <div className="min-w-0">
            <div className="text-[26px] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-none mb-1">
              {values[card.key]}
              {/* Suffix only if value is not the fallback dash */}
              {values[card.key] !== "—" && (
                <span className="text-[16px] font-bold ml-0.5">
                  {card.suffix}
                </span>
              )}
            </div>
            <div className="text-[12px] text-(--color-text-500) font-medium leading-tight">
              {card.label}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default AnalyticsKpiStrip;
