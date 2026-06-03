"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "@/components/dashboard";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { usePusherChannel } from "@/hooks/use-pusher-channel";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { getDashboardChartData } from "@/lib/actions/dashboard";
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
  initialStats: DashboardStats; // seeded from server — no loading flash on first render
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
  // messagesUsed/Limit come from org table — separate from stats, updated via usage:updated
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
  const queryClient = useQueryClient();
  const chartInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ── Stats query — seeded with server data, refetches when usage:updated fires ──
  const { data: stats } = useQuery({
    queryKey: ["dashboard", orgId, "stats"],
    queryFn: getDashboardStats,
    initialData: initialStats,
  });

  // ── Usage bar state ──
  const { data: usageData } = useQuery({
    queryKey: ["dashboard", orgId, "usage"],
    queryFn: async () => ({
      messagesUsed: initialMessagesUsed,
      messagesLimit: initialMessagesLimit,
    }),
    initialData: {
      messagesUsed: initialMessagesUsed,
      messagesLimit: initialMessagesLimit,
    },
  });

  // ── Chart data query — seeded with server props, refetches when usage:updated fires ──
  // Separate from stats query — chart series data is timezone-sensitive and heavier
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
    // Charts don't need to be as fresh as stat cards — 60s stale time reduces DB load
    staleTime: 60_000,
  });

  // ── Recent conversations — live-updated via Pusher ──
  const [newConversation, setNewConversation] =
    useState<ConversationRowType | null>(null);

  const [latestPanelMessage, setLatestPanelMessage] =
    useState<ConversationRowType | null>(null); // Full row payload keeps the overview panel authoritative.

  const [latestStatusUpdate, setLatestStatusUpdate] = useState<{
    conversationId: number;
    handoffStatus: string;
  } | null>(null);

  // ── Pusher: invalidate all queries when a message is processed ──
  const handleUsageUpdated = useCallback(
    (payload: { messagesUsed: number; messagesLimit: number }) => {
      // Stat cards — total messages, answered rate, unique visitors, response time
      // Debounce chart invalidation — charts don't need to update on every message
      // 10s window collapses bursts of messages into a single refetch
      if (chartInvalidateTimer.current)
        clearTimeout(chartInvalidateTimer.current);
      chartInvalidateTimer.current = setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["dashboard", orgId, "stats"],
        });
      }, 10_000);

      // Charts — daily trend, weekly bar, monthly line all need new data point
      void queryClient.invalidateQueries({
        queryKey: ["dashboard", orgId, "charts"],
      });

      // Usage bar — set directly from payload, no extra DB round trip needed
      queryClient.setQueryData(["dashboard", orgId, "usage"], {
        messagesUsed: payload.messagesUsed,
        messagesLimit: payload.messagesLimit,
      });
    },
    [queryClient, orgId],
  );

  // New conversation from Pusher — fetch full row then pass to panel
  const handleConversationNew = useCallback(
    async (payload: { conversationId: number }) => {
      try {
        // Wait 2s before fetching — conversation:new fires before handleStreamComplete
        // saves the first messages. Without delay, lastMessage comes back null.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const res = await fetch(`/api/conversations/${payload.conversationId}`);
        const json = (await res.json()) as {
          ok: boolean;
          data: ConversationRowType;
        };
        if (json.ok && json.data) {
          setNewConversation(json.data);
        }
      } catch {
        // Non-critical — panel updates on next refresh
      }
    },
    [],
  );

  // New message from Pusher — update existing row preview in panel
  const handleMessage = useCallback(
    async (payload: { conversationId: number; content?: string }) => {
      try {
        const res = await fetch(`/api/conversations/${payload.conversationId}`); // Always refetch the row so the panel uses server timestamps and counts.
        const json = (await res.json()) as {
          ok: boolean;
          data: ConversationRowType;
        };
        if (json.ok && json.data) {
          setLatestPanelMessage(json.data); // Store the full conversation row, not a client-built partial.
        }
      } catch {
        // Non-critical — panel updates on next refresh.
      }
    },
    [],
  );

  const handleTakeover = useCallback(
    (payload: { conversationId: number; handoffStatus?: string }) => {
      setLatestStatusUpdate({
        conversationId: payload.conversationId,
        handoffStatus: payload.handoffStatus ?? "human",
      });
    },
    [],
  );

  const handleReturn = useCallback((payload: { conversationId: number }) => {
    setLatestStatusUpdate({
      conversationId: payload.conversationId,
      handoffStatus: "ai",
    });
  }, []);

  // Subscribe to org channel — Pusher reuses existing WebSocket, no second connection
  usePusherChannel(orgId, {
    onUsageUpdated: handleUsageUpdated,
    onConversationNew: handleConversationNew,
    onMessage: handleMessage,
    onTakeover: handleTakeover,
    onReturn: handleReturn,
  });
  // Quota percentage for donut chart — derived from live usage data
  const quotaUsed = Math.min(
    ((usageData.messagesUsed ?? 0) / (usageData.messagesLimit || 1)) * 100,
    100,
  );

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

      {/* ── Stat cards row — all four update live via stats query ── */}
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
        {/* Performance summary — answeredRate and quotaUsed both live-updated */}
        <div className="card-base">
          <CardHeader
            title="Ringkasan Performa"
            subtitle={`Bulan ${new Date().toLocaleString("id-ID", { month: "long" })} ${currentYear}`}
          />
          <DonutCharts
            answeredRate={stats.answeredRate}
            quotaUsed={quotaUsed}
          />
        </div>

        {/* Daily trend — server-fetched, not live (chart data is historical) */}
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
            <AreaChart data={chartData.dailyTrend} />
          </div>
        </div>
      </div>

      {/* ── Charts row 2: Line + Bar stacked left, Conversations panel right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-stretch">
        {/* Left column — two charts stacked */}
        <div className="flex flex-col gap-4">
          <div className="card-base">
            <CardHeader title="Pesan per Hari" subtitle="Minggu ini" />
            <div className="px-5 pt-3 pb-5">
              <BarChart data={chartData.weeklyMessages} />
            </div>
          </div>

          <div className="card-base">
            <CardHeader title="Total Pesan Bulanan" />
            <div className="px-5 pt-3 pb-5">
              <LineChart
                current={chartData.monthlyCurrent}
                previous={chartData.monthlyPrevious}
                currentYear={chartData.currentYear}
                previousYear={chartData.currentYear - 1}
              />
            </div>
          </div>
        </div>

        {/* Right column — recent conversations panel, matches left column height */}
        <div className="h-full lg:sticky lg:top-4">
          <RecentConversationsPanel
            initialConversations={initialRecentConversations}
            newConversation={newConversation}
            latestMessage={latestPanelMessage}
            latestStatusUpdate={latestStatusUpdate}
          />
        </div>
      </div>

      {/* ── Bot status panel — usage bar uses live usageData ── */}
      {botStatus && (
        <div className="mt-4">
          <BotStatusPanel
            orgSlug={orgSlug}
            language={botStatus.language}
            isActive={botStatus.isActive}
            accentColor={botStatus.accentColor}
            documentCount={botStatus.documentCount}
            totalChunks={botStatus.totalChunks}
            messagesUsed={usageData.messagesUsed}
            messagesLimit={usageData.messagesLimit}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
