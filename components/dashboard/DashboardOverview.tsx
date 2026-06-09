"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";
import { StatCard } from "@/components/dashboard";
import { staggerContainer, staggerItem } from "@/lib/animations";
import {
  getDashboardStats,
  getDashboardChartData,
} from "@/lib/actions/dashboard";
import type { DashboardStats } from "@/lib/actions/dashboard";
import type { ConversationRow as ConversationRowType } from "@/types/api";

// ── Dynamic imports — Chart.js only loads after shell renders ──
const DonutCharts = dynamic(
  () => import("@/components/dashboard/charts/DonutCharts"),
  {
    loading: () => (
      <div className="flex justify-around items-center py-4 px-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2.5">
            <div className="w-[110px] h-[110px] rounded-full skeleton" />
            <div className="h-3 w-16 rounded skeleton" />
          </div>
        ))}
      </div>
    ),
    ssr: false,
  },
);

const AreaChart = dynamic(
  () => import("@/components/dashboard/charts/AreaChart"),
  {
    loading: () => <div className="h-[140px] skeleton rounded-[10px]" />,
    ssr: false,
  },
);

const LineChart = dynamic(
  () => import("@/components/dashboard/charts/LineChart"),
  {
    loading: () => <div className="h-[160px] skeleton rounded-[10px]" />,
    ssr: false,
  },
);

const BarChart = dynamic(
  () => import("@/components/dashboard/charts/BarChart"),
  {
    loading: () => <div className="h-[160px] skeleton rounded-[10px]" />,
    ssr: false,
  },
);

const RecentConversationsPanel = dynamic(
  () => import("@/components/dashboard/RecentConversationsPanel"),
  {
    loading: () => (
      <div className="card-base h-full min-h-[300px] skeleton rounded-[14px]" />
    ),
  },
);

const BotStatusPanel = dynamic(
  () => import("@/components/dashboard/BotStatusPanel"),
  { ssr: false },
);

// ── Props ──
interface DashboardOverviewProps {
  orgId: string;
  initialStats: DashboardStats;
  orgName: string;
  dailyTrend: { date: string; count: number }[];
  monthlyCurrent: number[];
  monthlyPrevious: number[];
  weeklyMessages: number[];
  currentYear: number;
  botStatus: {
    language: string;
    isActive: boolean;
    accentColor: string;
    documentCount: number;
    totalChunks: number;
  } | null;
  orgSlug: string;
  initialMessagesUsed: number;
  initialMessagesLimit: number;
  initialRecentConversations: ConversationRowType[];
}

// ── Card header — reused across all chart cards ──
const CardHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between px-5 pt-5 pb-0">
    <div>
      <div className="text-[15px] font-bold tracking-[-0.02em] text-(--color-text-900)">
        {title}
      </div>
      {subtitle && (
        <div className="text-[11.5px] text-(--color-text-400) mt-0.5">
          {subtitle}
        </div>
      )}
    </div>
    {action && <div>{action}</div>}
  </div>
);

const DashboardOverview = ({
  orgId,
  initialStats,
  orgName,
  dailyTrend,
  monthlyCurrent,
  monthlyPrevious,
  weeklyMessages,
  currentYear,
  botStatus,
  orgSlug,
  initialMessagesUsed,
  initialMessagesLimit,
  initialRecentConversations,
}: DashboardOverviewProps) => {
  // ── Stats query — invalidated by PusherProvider on usage:updated ──
  const { data: stats } = useQuery({
    queryKey: ["dashboard", orgId, "stats"],
    queryFn: getDashboardStats,
    initialData: initialStats,
    initialDataUpdatedAt: 0, // Force stale immediately — invalidation always triggers a refetch
    staleTime: 0, // Always refetch when invalidated
    refetchOnWindowFocus: false,
  });

  // ── Chart data query — invalidated by PusherProvider on usage:updated (debounced) ──
  const { data: chartData } = useQuery({
    queryKey: ["dashboard", orgId, "charts"],
    queryFn: getDashboardChartData,
    initialData: {
      dailyTrend,
      monthlyCurrent,
      monthlyPrevious,
      weeklyMessages,
      currentYear,
    },
    initialDataUpdatedAt: 0, // Force stale immediately — invalidation always triggers a refetch
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // ── Usage — read from Zustand, set by PusherProvider on usage:updated ──
  // Falls back to server-seeded initial values until the first Pusher event fires
  const storeMessagesUsed = useConversationStore((s) => s.messagesUsed);
  const storeMessagesLimit = useConversationStore((s) => s.messagesLimit);
  const messagesUsed = storeMessagesUsed ?? initialMessagesUsed;
  const messagesLimit = storeMessagesLimit ?? initialMessagesLimit;

  // Read accentColor from store
  const accentColor = useConversationStore((s) => s.accentColor);

  // Quota percentage for donut chart
  const quotaUsed = Math.min((messagesUsed / (messagesLimit || 1)) * 100, 100);

  const formatCount = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
          Dashboard
        </h1>
        <p className="text-[14px] text-(--color-text-500) mt-1">
          Selamat datang, {orgName} 👋
        </p>
      </div>

      {/* ── Stat cards ── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={staggerItem}>
          <StatCard
            icon="💬"
            iconVariant="brand"
            value={formatCount(stats.totalMessages)}
            label="Total Pesan"
            changeDirection="up"
            changeLabel="Semua waktu"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            icon="✅"
            iconVariant="teal"
            value={`${stats.answeredRate}%`}
            label="Terjawab Otomatis"
            changeDirection={stats.answeredRate >= 90 ? "up" : "down"}
            changeLabel={
              stats.answeredRate >= 90 ? "Sangat baik" : "Perlu ditingkatkan"
            }
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            icon="👥"
            iconVariant="amber"
            value={formatCount(stats.uniqueVisitors)}
            label="Pengunjung Unik"
            changeDirection="neutral"
            changeLabel="Semua sesi"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            icon="⚡"
            iconVariant="rose"
            value={stats.avgResponseTime ?? "—"}
            label="Avg. Response Time"
            changeDirection={stats.avgResponseTime ? "up" : "neutral"}
            changeLabel={
              stats.avgResponseTime ? "Rata-rata KUN" : "Belum ada data"
            }
          />
        </motion.div>
      </motion.div>

      {/* ── Charts row 1: Donuts + Area ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 mb-4">
        <div className="card-base">
          <CardHeader
            title="Ringkasan Performa"
            subtitle={`Bulan ${new Date().toLocaleString("id-ID", { month: "long" })} ${chartData.currentYear}`}
          />
          <DonutCharts
            answeredRate={stats.answeredRate}
            quotaUsed={quotaUsed}
            accentColor={accentColor}
          />
        </div>

        <div className="card-base">
          <CardHeader
            title="Tren Percakapan"
            subtitle="Volume pesan harian — 30 hari terakhir"
            action={
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11.5px] font-semibold bg-(--color-brand) text-white transition-all hover:bg-(--color-brand-dark)">
                ⬇ Simpan Laporan
              </button>
            }
          />
          <div className="px-5 pt-3 pb-5">
            <AreaChart data={chartData.dailyTrend} accentColor={accentColor} />
          </div>
        </div>
      </div>

      {/* ── Charts row 2: Bar + Line left, Conversations panel right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-stretch">
        <div className="flex flex-col gap-4">
          <div className="card-base flex-1">
            <CardHeader title="Pesan per Hari" subtitle="Minggu ini" />
            <div className="px-5 pt-3 pb-5">
              <BarChart
                data={chartData.weeklyMessages}
                accentColor={accentColor}
              />
            </div>
          </div>

          <div className="card-base flex-1">
            <CardHeader title="Total Pesan Bulanan" />
            <div className="px-5 pt-3 pb-5">
              <LineChart
                current={chartData.monthlyCurrent}
                previous={chartData.monthlyPrevious}
                currentYear={chartData.currentYear}
                previousYear={chartData.currentYear - 1}
                accentColor={accentColor}
              />
            </div>
          </div>
        </div>

        <div className="h-full lg:sticky lg:top-4">
          <RecentConversationsPanel
            initialConversations={initialRecentConversations}
          />
        </div>
      </div>

      {/* ── Bot status panel ── */}
      {botStatus && (
        <div className="mt-4">
          <BotStatusPanel
            orgSlug={orgSlug}
            language={botStatus.language}
            isActive={botStatus.isActive}
            accentColor={accentColor}
            documentCount={botStatus.documentCount}
            totalChunks={botStatus.totalChunks}
            messagesUsed={messagesUsed}
            messagesLimit={messagesLimit}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
