"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import AnalyticsKpiStrip from "@/components/dashboard/analytics/AnalyticsKpiStrip";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type { DeliveryChannel } from "@/types/chat";

// Dynamic imports — Chart.js is heavy, load after shell renders
const HandoffInsightCard = dynamic(
  () => import("@/components/dashboard/analytics/HandoffInsightCard"),
  {
    ssr: false,
    loading: () => (
      <div className="card-base p-6 col-span-2">
        <div className="skeleton rounded-[10px] h-full min-h-[300px]" />
      </div>
    ),
  },
);
const TopQuestionsCard = dynamic(
  () => import("@/components/dashboard/analytics/TopQuestionsCard"),
  {
    ssr: false,
    loading: () => (
      <div className="card-base p-6">
        <div className="skeleton rounded-[10px] h-[300px] w-full" />
      </div>
    ),
  },
);
const ChannelBreakdownCard = dynamic(
  () => import("@/components/dashboard/analytics/ChannelBreakdownCard"),
  {
    ssr: false,
    loading: () => (
      <div className="card-base p-6">
        <div className="skeleton rounded-[10px] h-[300px] w-full" />
      </div>
    ),
  },
);
const PeakHoursCard = dynamic(
  () => import("@/components/dashboard/analytics/PeakHoursCard"),
  {
    ssr: false,
    loading: () => (
      <div className="card-base p-6">
        <div className="skeleton rounded-[10px] h-[300px] w-full" />
      </div>
    ),
  },
);

// Lazy-load the two line charts — both use Chart.js
const AreaChart = dynamic(
  () => import("@/components/dashboard/charts/AreaChart"),
  {
    ssr: false,
    loading: () => <div className="skeleton rounded-[10px] h-[140px] w-full" />,
  },
);

const ResponseTrendChart = dynamic(
  () => import("@/components/dashboard/charts/ResponseTrendChart"),
  {
    ssr: false,
    loading: () => <div className="skeleton rounded-[10px] h-[140px] w-full" />,
  },
);

// ── All data types passed from the Server Component ──
interface AnalyticsPageProps {
  // KPI strip
  totalConversations: number;
  resolutionRate: number;
  handoffRate: number;
  avgResponseTime: string | null;
  // Handoff insight
  aiCount: number;
  handoffCount: number;
  handoffTrend: { date: string; avgMs: number }[];
  // Top questions
  topQuestions: { question: string; count: number }[];
  // Channel breakdown
  channelBreakdown: { channel: DeliveryChannel; count: number }[];
  // Peak hours
  peakHours: number[];
  // Message volume trend
  dailyTrend: { date: string; count: number }[];
  // Response time trend
  responseTrend: { date: string; avgMs: number }[];
}

const AnalyticsPage = ({
  totalConversations,
  resolutionRate,
  handoffRate,
  avgResponseTime,
  aiCount,
  handoffCount,
  handoffTrend,
  topQuestions,
  channelBreakdown,
  peakHours,
  dailyTrend,
  responseTrend,
}: AnalyticsPageProps) => {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
          Analytics
        </h1>
        <p className="text-[13px] text-(--color-text-500) mt-1">
          Pahami bagaimana pelanggan berinteraksi dengan chatbot kamu.
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {/* ── Row 1: KPI strip ── */}
        <AnalyticsKpiStrip
          totalConversations={totalConversations}
          resolutionRate={resolutionRate}
          handoffRate={handoffRate}
          avgResponseTime={avgResponseTime}
        />

        {/* ── Row 2: Handoff insight (wide) + Channel breakdown ── */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <HandoffInsightCard
              aiCount={aiCount}
              handoffCount={handoffCount}
              handoffRate={handoffRate}
              trend={handoffTrend}
            />
          </div>
          <ChannelBreakdownCard data={channelBreakdown} />
        </div>

        {/* ── Row 3: Top questions + Peak hours ── */}
        <div className="grid grid-cols-2 gap-5">
          <TopQuestionsCard questions={topQuestions} />
          <PeakHoursCard data={peakHours} />
        </div>

        {/* ── Row 4: Message volume trend + Response time trend ── */}
        <div className="grid grid-cols-2 gap-5">
          {/* Message volume */}
          <div className="card-base p-6">
            <div className="mb-4">
              <h2 className="text-[15px] font-bold text-(--color-text-900)">
                Volume Pesan
              </h2>
              <p className="text-[12px] text-(--color-text-400) mt-0.5">
                Total pesan harian — 30 hari terakhir
              </p>
            </div>
            {dailyTrend.length > 0 ? (
              <AreaChart data={dailyTrend} />
            ) : (
              <div className="h-[140px] flex items-center justify-center">
                <p className="text-[12px] text-(--color-text-400)">
                  Belum ada data pesan
                </p>
              </div>
            )}
          </div>

          {/* Response time trend */}
          <div className="card-base p-6">
            <div className="mb-4">
              <h2 className="text-[15px] font-bold text-(--color-text-900)">
                Tren Response Time
              </h2>
              <p className="text-[12px] text-(--color-text-400) mt-0.5">
                Rata-rata waktu respons AI per hari
              </p>
            </div>
            {responseTrend.length > 0 ? (
              <ResponseTrendChart data={responseTrend} />
            ) : (
              <div className="h-[140px] flex items-center justify-center">
                <p className="text-[12px] text-(--color-text-400)">
                  Belum ada data response time
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AnalyticsPage;
