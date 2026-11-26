"use client";

// "Kesehatan Operasional" — the donut is the share of conversations that finished without staff;
// the three small stats are shortcuts to where each one is managed

import Link from "next/link";
import {
  getQuotaUsageLevel,
  quotaPercent,
} from "@/helpers/dashboard-priorities";
import {
  getHandoffFreeSummary,
  getHealthLabel,
} from "@/helpers/operational-health";

interface HealthCardProps {
  botActive: boolean;
  pendingHandoffCount: number;
  quotaUsed: number;
  quotaLimit: number;
  totalConversationCount: number;
  totalHandoffCount: number;
  // Config and Billing are admin-only; members get plain text for those two stats
  isAdmin: boolean;
}

// One mini stat — a link when it has a destination, plain text otherwise
const Stat = ({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string | null;
}) => {
  const content = (
    <>
      {label}
      <b className="block text-(--color-text-900)">{value}</b>
    </>
  );
  const base = "-m-1 rounded-[8px] p-1 text-(--color-text-500)";
  return href ? (
    <Link
      href={href}
      className={`${base} transition-colors hover:bg-(--color-bg-page) focus:outline-none focus:ring-2 focus:ring-(--color-brand)`}
    >
      {content}
    </Link>
  ) : (
    <span className={base}>{content}</span>
  );
};

const HealthCard = ({
  botActive,
  pendingHandoffCount,
  quotaUsed,
  quotaLimit,
  totalConversationCount,
  totalHandoffCount,
  isAdmin,
}: HealthCardProps) => {
  const summary = getHandoffFreeSummary(
    totalConversationCount,
    totalHandoffCount,
  );
  const label = getHealthLabel({
    pendingHandoffCount,
    quotaLevel: getQuotaUsageLevel(quotaUsed, quotaLimit),
    botActive,
  });
  const ringPercent = summary?.percent ?? 0;

  return (
    <section
      className="card-base block p-5"
      aria-labelledby="operational-health-title"
    >
      <div className="flex items-center gap-4">
        {/* Gray ring and a dash when there is nothing to measure yet */}
        <div
          role="img"
          aria-label={
            summary
              ? `${summary.percent}% percakapan tanpa handoff`
              : "Belum ada percakapan untuk diukur"
          }
          className="relative flex size-16 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-brand) ${ringPercent}%, var(--color-bg-page) 0)`,
          }}
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-(--color-bg-card) text-[12px] font-extrabold text-(--color-text-900)">
            {summary ? `${summary.percent}%` : "—"}
          </div>
        </div>
        <div className="min-w-0">
          <h2
            id="operational-health-title"
            className="text-[15px] font-bold text-(--color-text-900)"
          >
            Kesehatan Operasional
          </h2>
          <p className="mt-1 text-[11.5px] leading-snug text-(--color-text-500)">
            {label}
          </p>
        </div>
      </div>

      {/* Names what the percentage counts, so the number is never a mystery */}
      <p className="mt-3 text-[10.5px] text-(--color-text-400)">
        {summary
          ? `${summary.withoutStaff.toLocaleString("id-ID")} dari ${summary.total.toLocaleString("id-ID")} percakapan tanpa handoff`
          : "Belum ada percakapan untuk diukur"}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-(--color-border-sm) pt-3 text-[10px]">
        <Stat
          label="KUN"
          value={botActive ? "Aktif" : "Nonaktif"}
          href={isAdmin ? "/dashboard/chatbot" : null}
        />
        <Stat
          label="Total handoff"
          value={String(totalHandoffCount)}
          href="/dashboard/conversations"
        />
        <Stat
          label="Kuota"
          value={`${quotaPercent(quotaUsed, quotaLimit)}%`}
          href={isAdmin ? "/dashboard/billing" : null}
        />
      </div>
    </section>
  );
};

export default HealthCard;
