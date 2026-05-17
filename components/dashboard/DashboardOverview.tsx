"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { StatCard } from "@/components/dashboard";
import { staggerContainer, staggerItem } from "@/lib/animations";

// ── Dynamic imports — Chart.js only loads after shell renders ──
// Each chart is its own file so code splitting works correctly
const DonutCharts = dynamic(
  () => import("@/components/dashboard/charts/DonutCharts"),
  {
    // Skeleton shown while Chart.js bundle loads
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
    ssr: false, // Chart.js uses browser APIs — must be client-only
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

const BotStatusPanel = dynamic(
  () => import("@/components/dashboard/BotStatusPanel"),
  { ssr: false },
);

// ── Props — all pre-fetched on server ──
interface DashboardOverviewProps {
  totalMessages: number;
  answeredRate: number;
  uniqueVisitors: number;
  orgName: string;
  dailyTrend: { date: string; count: number }[];
  monthlyCurrent: number[];
  monthlyPrevious: number[];
  weeklyMessages: number[];
  currentYear: number;
  // Bot status panel props
  botStatus: {
    name: string;
    language: string;
    tone: string;
    isActive: boolean;
    accentColor: string;
    documentCount: number;
    totalChunks: number;
  } | null;
  orgSlug: string;
  messagesUsed: number;
  messagesLimit: number;
  avgResponseTime: string | null;
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
  totalMessages,
  answeredRate,
  uniqueVisitors,
  orgName,
  dailyTrend,
  monthlyCurrent,
  monthlyPrevious,
  weeklyMessages,
  currentYear,
  botStatus,
  orgSlug,
  messagesUsed,
  messagesLimit,
  avgResponseTime,
}: DashboardOverviewProps) => {
  // Quota used percentage — messagesUsed / messagesLimit
  // We have totalMessages; limit comes from org — approximating with answeredRate context
  // TODO: pass messagesLimit from org query in Phase 6 when billing is built
  const quotaUsed = Math.min((totalMessages / 1000) * 100, 100);

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
        <p className="text-[13px] text-(--color-text-500) mt-1">
          Halo {orgName} 👋 — Selamat datang kembali di Kundesk
        </p>
      </div>

      {/* ── Stat cards row ── */}
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
            value={formatCount(totalMessages)}
            label="Total Pesan"
            changeDirection="up"
            changeLabel="Semua waktu"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            icon="✅"
            iconVariant="teal"
            value={`${answeredRate}%`}
            label="Terjawab Otomatis"
            changeDirection={answeredRate >= 90 ? "up" : "down"}
            changeLabel={
              answeredRate >= 90 ? "Sangat baik" : "Perlu ditingkatkan"
            }
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            icon="👥"
            iconVariant="amber"
            value={formatCount(uniqueVisitors)}
            label="Pengunjung Unik"
            changeDirection="neutral"
            changeLabel="Semua sesi"
          />
        </motion.div>
        {/* Response time — mock until timing column added in Phase 7 */}
        <motion.div variants={staggerItem}>
          <StatCard
            icon="⚡"
            iconVariant="rose"
            value={avgResponseTime ?? "—"}
            label="Avg. Response Time"
            changeDirection={avgResponseTime ? "up" : "neutral"}
            changeLabel={avgResponseTime ? "Rata-rata AI" : "Belum ada data"}
          />
        </motion.div>
      </motion.div>

      {/* ── Charts row 1: Donuts + Area ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 mb-4">
        {/* Performance summary — 3 donut charts */}
        <div className="card-base">
          <CardHeader
            title="Ringkasan Performa"
            subtitle={`Bulan ${new Date().toLocaleString("id-ID", { month: "long" })} ${currentYear}`}
          />
          <DonutCharts answeredRate={answeredRate} quotaUsed={quotaUsed} />
        </div>

        {/* Daily trend — area chart */}
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
            <AreaChart data={dailyTrend} />
          </div>
        </div>
      </div>

      {/* ── Charts row 2: Line + Bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Monthly comparison — dual line chart */}
        <div className="card-base">
          <CardHeader title="Total Pesan Bulanan" />
          <div className="px-5 pt-3 pb-5">
            <LineChart
              current={monthlyCurrent}
              previous={monthlyPrevious}
              currentYear={currentYear}
              previousYear={currentYear - 1}
            />
          </div>
        </div>

        {/* Weekly breakdown — bar chart */}
        <div className="card-base">
          <CardHeader title="Pesan per Hari" subtitle="Minggu ini" />
          <div className="px-5 pt-3 pb-5">
            <BarChart data={weeklyMessages} />
          </div>
        </div>
      </div>

      {/* ── Bot status panel ── */}
      {botStatus && (
        <div className="mt-4">
          <BotStatusPanel
            orgSlug={orgSlug}
            name={botStatus.name}
            language={botStatus.language}
            tone={botStatus.tone}
            isActive={botStatus.isActive}
            accentColor={botStatus.accentColor}
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
