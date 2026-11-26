"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { QuotaCard, HealthCard, PriorityPanel } from "@/components/dashboard";
import { useConversationStore } from "@/stores/conversation-store";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { getLiveOverviewSnapshotAction } from "@/lib/actions/dashboard";
import { deriveDashboardPriorities } from "@/helpers/dashboard-priorities";
import type { ConversationRow as ConversationRowType } from "@/types/api";
import type {
  DashboardChartData,
  LiveOverviewSnapshot,
  LiveConversationPreview,
  RecentKnowledgeItem,
} from "@/types/dashboard";

const RecentConversationsPanel = dynamic(
  () => import("@/components/dashboard/RecentConversationsPanel"),
  { loading: () => <div className="min-h-96 rounded-md skeleton" /> },
);
const LiveConversationWorkspace = dynamic(
  () => import("@/components/dashboard/LiveConversationWorkspace"),
  { loading: () => <div className="min-h-[520px] rounded-md skeleton" /> },
);
const ActivitySnapshotCard = dynamic(
  () => import("@/components/dashboard/ActivitySnapshotCard"),
  { loading: () => <div className="min-h-40 rounded-md skeleton" /> },
);
const KnowledgeKunPanel = dynamic(
  () => import("@/components/dashboard/KnowledgeKunPanel"),
  { loading: () => <div className="min-h-56 rounded-md skeleton" /> },
);

interface DashboardOverviewProps {
  orgId: string;
  initialLiveOverview: LiveOverviewSnapshot;
  orgName: string;
  orgImageUrl: string | null;
  initialRecentConversations: ConversationRowType[];
  initialLiveConversationPreview: LiveConversationPreview | null;
  initialDashboardCharts: DashboardChartData;
  initialKnowledgeItems: RecentKnowledgeItem[];
}

const Metric = ({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) => (
  <div className="card-base flex min-w-0 gap-3 p-4">
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-[12px] text-lg ${tone}`}
      aria-hidden="true"
    >
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-(--color-text-400)">
        {label}
      </p>
      <p className="mt-1 text-[25px] font-extrabold leading-none tracking-[-0.04em] text-(--color-text-900)">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-(--color-text-500)">{detail}</p>
    </div>
  </div>
);

const DashboardOverview = ({
  orgId,
  initialLiveOverview,
  orgName,
  orgImageUrl,
  initialRecentConversations,
  initialLiveConversationPreview,
  initialDashboardCharts,
  initialKnowledgeItems,
}: DashboardOverviewProps) => {
  const { data: overview } = useQuery({
    queryKey: ["dashboard", orgId, "live-overview"],
    queryFn: getLiveOverviewSnapshotAction,
    initialData: initialLiveOverview,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const used =
    useConversationStore((s) => s.messagesUsed) ??
    overview.organization.messagesUsed;
  const limit =
    useConversationStore((s) => s.messagesLimit) ??
    overview.organization.messagesLimit;
  const bot = overview.bot;
  const initials = orgName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  // Admin-only items (billing, KUN settings, knowledge health) stay hidden from members —
  // the pages enforce permissions anyway; this only keeps the card relevant for the viewer
  const { orgRole } = useAuth();
  const isAdmin = orgRole === "org:admin";
  const priorities = deriveDashboardPriorities({
    isAdmin,
    pendingHandoffCount: overview.queue.pendingHandoffCount,
    // No chatbot row at all counts as inactive, like the old card did
    botActive: bot?.isActive ?? false,
    quotaUsed: used,
    quotaLimit: limit,
    subscriptionStatus: overview.organization.subscriptionStatus,
    failedDocumentCount: overview.knowledgeHealth.failedDocumentCount,
    staleEntryCount: overview.knowledgeHealth.staleEntryCount,
  });

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <header className="card-base p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-(--color-brand) text-[13px] font-extrabold text-white">
                {orgImageUrl ? (
                  <Image
                    src={orgImageUrl}
                    alt=""
                    width={44}
                    height={44}
                    className="size-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <h1 className="text-[24px] font-extrabold tracking-[-0.04em] text-(--color-text-900)">
                {orgName}
              </h1>
            </div>
            <p className="mt-1.5 text-[13px] text-(--color-text-500)">
              Pantau percakapan dan kesehatan operasional bisnis secara
              langsung.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11.5px] font-semibold">
            <span className="rounded-full bg-(--color-bg-page) px-3 py-2 text-(--color-text-700)">
              <span className="mr-1.5 text-(--color-brand)">●</span>
              {overview.queue.activeConversationCount} percakapan aktif
            </span>
            <span
              className={`rounded-full px-3 py-2 ${overview.queue.pendingHandoffCount > 0 ? "bg-(--color-danger-bg) text-(--color-danger)" : "bg-(--color-success-bg) text-(--color-success)"}`}
            >
              {overview.queue.pendingHandoffCount > 0
                ? `${overview.queue.pendingHandoffCount} menunggu staff`
                : "Tidak ada handoff tertunda"}
            </span>
          </div>
        </div>
        <motion.section
          className="mt-5 grid grid-cols-2 gap-2 xl:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={staggerItem}>
            <Metric
              icon="💬"
              label="Pesan Hari Ini"
              value={overview.stats.messagesToday.toLocaleString("id-ID")}
              detail="Zona waktu bisnis"
              tone="bg-(--color-brand-light) text-(--color-brand)"
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <Metric
              icon="✦"
              label="Auto-Bot"
              value={`${overview.stats.answeredRate}%`}
              detail="Jawaban KUN"
              tone="bg-(--color-success-bg) text-(--color-success)"
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <Metric
              icon="⚡"
              label="Avg. Respon"
              value={overview.stats.avgResponseTime ?? "—"}
              detail="Rata-rata KUN"
              tone="bg-(--color-warning-bg) text-(--color-warning)"
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <Metric
              icon="👥"
              label="Pengunjung Unik"
              value={overview.stats.uniqueVisitors.toLocaleString("id-ID")}
              detail="Semua sesi"
              tone="bg-(--color-info-bg) text-(--color-info)"
            />
          </motion.div>
        </motion.section>
      </header>

      <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)_250px] xl:items-start">
        <section className="order-3 min-w-0 space-y-4 xl:order-1">
          <div className="xl:h-[584px]">
            <RecentConversationsPanel
              initialConversations={initialRecentConversations}
            />
          </div>
          <ActivitySnapshotCard
            orgId={orgId}
            initialDashboardCharts={initialDashboardCharts}
          />
        </section>
        <section className="order-1 min-w-0 space-y-4 xl:order-2">
          <LiveConversationWorkspace
            orgId={orgId}
            bot={bot}
            initialPreview={initialLiveConversationPreview}
            quotaUsed={used}
            quotaLimit={limit}
            pendingHandoffCount={overview.queue.pendingHandoffCount}
          />
        </section>
        <aside className="order-4 grid content-start gap-4 sm:grid-cols-2 xl:order-3 xl:grid-cols-1">
          <KnowledgeKunPanel
            orgId={orgId}
            initialItems={initialKnowledgeItems}
            documentCount={bot?.documentCount ?? 0}
            totalChunks={bot?.totalChunks ?? 0}
          />
          <QuotaCard
            used={used}
            limit={limit}
            plan={overview.organization.plan}
            isAdmin={isAdmin}
          />
          <HealthCard
            botActive={bot?.isActive ?? false}
            pendingHandoffCount={overview.queue.pendingHandoffCount}
            quotaUsed={used}
            quotaLimit={limit}
            totalConversationCount={overview.stats.totalConversationCount}
            totalHandoffCount={overview.stats.totalHandoffCount}
            isAdmin={isAdmin}
          />
          <PriorityPanel
            items={priorities.items}
            allClear={priorities.allClear}
          />
        </aside>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.03em] text-(--color-text-900)">
              Stasiun Operasional
            </h2>
            <p className="mt-0.5 text-[11.5px] text-(--color-text-400)">
              Pintasan ke area kerja yang memakai status nyata.
            </p>
          </div>
          <Link
            href="/dashboard/team"
            className="text-[11px] font-semibold text-(--color-brand) hover:underline"
          >
            Kelola tim →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/dashboard/chatbot"
            className="card-base card-hover block p-4"
          >
            <p className="text-[11px] font-bold text-(--color-text-900)">
              KUN AI
            </p>
            <p className="mt-1 text-[11px] text-(--color-text-500)">
              {bot?.isActive ? "Autopilot aktif" : "Autopilot nonaktif"}
            </p>
          </Link>
          <Link
            href="/dashboard/conversations"
            className="card-base card-hover block p-4"
          >
            <p className="text-[11px] font-bold text-(--color-text-900)">
              Antrean
            </p>
            <p className="mt-1 text-[11px] text-(--color-text-500)">
              {overview.queue.activeConversationCount} aktif ·{" "}
              {overview.queue.pendingHandoffCount} tertunda
            </p>
          </Link>
          <Link
            href="/dashboard/team"
            className="card-base card-hover block p-4"
          >
            <p className="text-[11px] font-bold text-(--color-text-900)">Tim</p>
            <p className="mt-1 text-[11px] text-(--color-text-500)">
              Kelola anggota dan peran
            </p>
          </Link>
          <Link
            href="/dashboard/knowledge"
            className="card-base card-hover block p-4"
          >
            <p className="text-[11px] font-bold text-(--color-text-900)">
              Knowledge
            </p>
            <p className="mt-1 text-[11px] text-(--color-text-500)">
              {bot
                ? `${bot.totalChunks.toLocaleString("id-ID")} chunks tersedia`
                : "Belum ada knowledge"}
            </p>
          </Link>
        </div>
      </section>

      <Link
        href="/dashboard/analytics"
        className="flex items-center justify-between rounded-[14px] border border-(--color-border) bg-(--color-bg-card) px-5 py-4 transition-colors hover:border-(--color-brand-mid) hover:bg-(--color-brand-light) focus:outline-none focus:ring-2 focus:ring-(--color-brand)"
      >
        <div>
          <p className="text-[13px] font-bold text-(--color-text-900)">
            Butuh analisis lebih dalam?
          </p>
          <p className="mt-0.5 text-[11.5px] text-(--color-text-500)">
            Tren, pertanyaan teratas, kanal, dan insight handoff ada di
            Analytics.
          </p>
        </div>
        <span className="shrink-0 text-[12px] font-semibold text-(--color-brand)">
          Buka Analytics →
        </span>
      </Link>
    </div>
  );
};

export default DashboardOverview;
