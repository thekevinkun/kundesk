"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";
import { staggerContainer, staggerItem } from "@/lib/animations";
import {
  getDashboardChartData,
  getLiveOverviewSnapshotAction,
} from "@/lib/actions/dashboard";
import type { ConversationRow as ConversationRowType } from "@/types/api";
import type { LiveOverviewSnapshot } from "@/types/dashboard";

const AreaChart = dynamic(() => import("@/components/dashboard/charts/AreaChart"), { loading: () => <div className="h-44 rounded-md skeleton" />, ssr: false });
const LineChart = dynamic(() => import("@/components/dashboard/charts/LineChart"), { loading: () => <div className="h-44 rounded-md skeleton" />, ssr: false });
const BarChart = dynamic(() => import("@/components/dashboard/charts/BarChart"), { loading: () => <div className="h-44 rounded-md skeleton" />, ssr: false });
const RecentConversationsPanel = dynamic(() => import("@/components/dashboard/RecentConversationsPanel"), { loading: () => <div className="min-h-96 rounded-md skeleton" /> });

interface DashboardOverviewProps {
  orgId: string;
  initialLiveOverview: LiveOverviewSnapshot;
  orgName: string;
  dailyTrend: { date: string; count: number }[];
  monthlyCurrent: number[];
  monthlyPrevious: number[];
  weeklyMessages: number[];
  currentYear: number;
  initialRecentConversations: ConversationRowType[];
}

const Metric = ({ icon, label, value, detail, tone }: { icon: string; label: string; value: string; detail: string; tone: string }) => (
  <div className="card-base flex min-w-0 gap-3 p-4">
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-[12px] text-lg ${tone}`} aria-hidden="true">{icon}</span>
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-(--color-text-400)">{label}</p>
      <p className="mt-1 text-[25px] font-extrabold leading-none tracking-[-0.04em] text-(--color-text-900)">{value}</p>
      <p className="mt-1.5 text-[11px] text-(--color-text-500)">{detail}</p>
    </div>
  </div>
);

const ChartCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <div className="card-base min-w-0">
    <div className="px-5 pt-5"><h2 className="text-[15px] font-bold tracking-[-0.02em] text-(--color-text-900)">{title}</h2><p className="mt-0.5 text-[11.5px] text-(--color-text-400)">{subtitle}</p></div>
    <div className="px-5 pb-5 pt-3">{children}</div>
  </div>
);

const DashboardOverview = ({ orgId, initialLiveOverview, orgName, dailyTrend, monthlyCurrent, monthlyPrevious, weeklyMessages, currentYear, initialRecentConversations }: DashboardOverviewProps) => {
  const { data: overview } = useQuery({
    queryKey: ["dashboard", orgId, "live-overview"], queryFn: getLiveOverviewSnapshotAction,
    initialData: initialLiveOverview, initialDataUpdatedAt: 0, staleTime: 0, refetchOnWindowFocus: false,
  });
  const { data: charts } = useQuery({
    queryKey: ["dashboard", orgId, "charts"], queryFn: getDashboardChartData,
    initialData: { dailyTrend, monthlyCurrent, monthlyPrevious, weeklyMessages, currentYear }, initialDataUpdatedAt: 0, staleTime: 0, refetchOnWindowFocus: false,
  });
  const accentColor = useConversationStore((s) => s.accentColor);
  const used = useConversationStore((s) => s.messagesUsed) ?? overview.organization.messagesUsed;
  const limit = useConversationStore((s) => s.messagesLimit) ?? overview.organization.messagesLimit;
  const quotaPct = Math.min((used / (limit || 1)) * 100, 100);
  const bot = overview.bot;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <header className="card-base p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-[24px] font-extrabold tracking-[-0.04em] text-(--color-text-900)">Dashboard</h1><span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${bot?.isActive ? "bg-(--color-success-bg) text-(--color-success)" : "bg-(--color-danger-bg) text-(--color-danger)"}`}>{bot?.isActive ? "KUN AKTIF" : "KUN NONAKTIF"}</span></div><p className="mt-1 text-[13px] text-(--color-text-500)">Pantau percakapan dan kesehatan operasional {orgName} secara langsung.</p></div>
          <div className="flex flex-wrap gap-2 text-[11.5px] font-semibold"><span className="rounded-full bg-(--color-bg-page) px-3 py-2 text-(--color-text-700)"><span className="mr-1.5 text-(--color-brand)">●</span>{overview.queue.activeConversationCount} percakapan aktif</span><span className={`rounded-full px-3 py-2 ${overview.queue.pendingHandoffCount > 0 ? "bg-(--color-danger-bg) text-(--color-danger)" : "bg-(--color-success-bg) text-(--color-success)"}`}>{overview.queue.pendingHandoffCount > 0 ? `${overview.queue.pendingHandoffCount} menunggu staff` : "Tidak ada handoff tertunda"}</span></div>
        </div>
      </header>

      <motion.section className="grid grid-cols-2 gap-3 lg:grid-cols-4" variants={staggerContainer} initial="hidden" animate="visible">
        <motion.div variants={staggerItem}><Metric icon="💬" label="Pesan Hari Ini" value={overview.stats.messagesToday.toLocaleString("id-ID")} detail="Pesan pelanggan di zona waktu bisnis" tone="bg-(--color-brand-light) text-(--color-brand)" /></motion.div>
        <motion.div variants={staggerItem}><Metric icon="✦" label="Auto-Bot" value={`${overview.stats.answeredRate}%`} detail="Jawaban KUN · seluruh waktu" tone="bg-(--color-success-bg) text-(--color-success)" /></motion.div>
        <motion.div variants={staggerItem}><Metric icon="⚡" label="Avg. Respon" value={overview.stats.avgResponseTime ?? "—"} detail="Rata-rata jawaban KUN · seluruh waktu" tone="bg-(--color-warning-bg) text-(--color-warning)" /></motion.div>
        <motion.div variants={staggerItem}><Metric icon="👥" label="Pengunjung Unik" value={overview.stats.uniqueVisitors.toLocaleString("id-ID")} detail="Semua sesi pelanggan" tone="bg-(--color-info-bg) text-(--color-info)" /></motion.div>
      </motion.section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <section className="min-w-0"><RecentConversationsPanel initialConversations={initialRecentConversations} /></section>
        <aside className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Link href="/dashboard/knowledge" className="card-base card-hover block p-5 focus:outline-none focus:ring-2 focus:ring-(--color-brand)"><div className="flex items-start justify-between gap-3"><span className="flex size-10 items-center justify-center rounded-[12px] bg-(--color-brand-light) text-lg">▤</span><span className="text-[11px] font-semibold text-(--color-brand)">Kelola →</span></div><h2 className="mt-4 text-[15px] font-bold text-(--color-text-900)">Knowledge KUN</h2><p className="mt-1 text-[12px] text-(--color-text-500)">{bot ? `${bot.documentCount} dokumen siap · ${bot.totalChunks.toLocaleString("id-ID")} chunks` : "Belum ada chatbot aktif"}</p></Link>
          <Link href="/dashboard/billing" className="card-base card-hover block p-5 focus:outline-none focus:ring-2 focus:ring-(--color-brand)"><div className="flex items-center justify-between"><h2 className="text-[15px] font-bold text-(--color-text-900)">Kuota Pesan</h2><span className="text-[11px] font-semibold text-(--color-brand)">Billing →</span></div><p className="mt-3 text-[22px] font-extrabold tracking-[-0.04em] text-(--color-text-900)">{used.toLocaleString("id-ID")} <span className="text-[13px] font-medium text-(--color-text-400)">/ {limit.toLocaleString("id-ID")}</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-(--color-bg-page)"><div className="h-full rounded-full bg-(--color-brand)" style={{ width: `${quotaPct}%` }} /></div></Link>
          {bot && <Link href="/dashboard/chatbot" className="card-base card-hover block p-5 focus:outline-none focus:ring-2 focus:ring-(--color-brand)"><div className="flex items-center justify-between"><div><h2 className="text-[15px] font-bold text-(--color-text-900)">Status KUN</h2><p className="mt-1 text-[12px] text-(--color-text-500)">{bot.isActive ? "Siap melayani pelanggan" : "Tidak menerima percakapan baru"}</p></div><span className={`size-3 rounded-full ${bot.isActive ? "bg-(--color-success)" : "bg-(--color-danger)"}`} aria-label={bot.isActive ? "KUN aktif" : "KUN nonaktif"} /></div></Link>}
        </aside>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Tren Percakapan" subtitle="Volume pesan pelanggan · 30 hari terakhir"><AreaChart data={charts.dailyTrend} accentColor={accentColor} /></ChartCard>
        <ChartCard title="Pesan per Hari" subtitle="Minggu berjalan"><BarChart data={charts.weeklyMessages} accentColor={accentColor} /></ChartCard>
        <div className="lg:col-span-2"><ChartCard title="Total Pesan Bulanan" subtitle="Perbandingan tahun berjalan dan sebelumnya"><LineChart current={charts.monthlyCurrent} previous={charts.monthlyPrevious} currentYear={charts.currentYear} previousYear={charts.currentYear - 1} accentColor={accentColor} /></ChartCard></div>
      </section>
    </div>
  );
};

export default DashboardOverview;
