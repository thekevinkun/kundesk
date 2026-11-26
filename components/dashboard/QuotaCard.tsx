"use client";

// "Kuota Pesan" — usage bar that changes color with the quota level, and an upgrade button
// that appears only when it is needed (from 80%) and a bigger plan exists

import Link from "next/link";
import { PLAN_BADGE } from "@/components/dashboard/settings/constants";
import { getQuotaCardState } from "@/helpers/quota-card";
import type { LiveOverviewSnapshot } from "@/types/dashboard";

interface QuotaCardProps {
  used: number;
  limit: number;
  plan: LiveOverviewSnapshot["organization"]["plan"];
  // Billing is admin-only, so members never see the upgrade button
  isAdmin: boolean;
}

// Tokens only, so dark mode and the accent color keep working
const BAR_COLOR = {
  ok: "bg-(--color-brand)",
  warning: "bg-(--color-warning)",
  full: "bg-(--color-danger)",
} as const;

const QuotaCard = ({ used, limit, plan, isAdmin }: QuotaCardProps) => {
  const state = getQuotaCardState(used, limit, plan);
  const planLabel = PLAN_BADGE[plan]?.label ?? PLAN_BADGE.free!.label;

  return (
    <section className="card-base block p-5" aria-labelledby="quota-card-title">
      <div className="flex items-center justify-between">
        <h2
          id="quota-card-title"
          className="text-[15px] font-bold text-(--color-text-900)"
        >
          Kuota Pesan
        </h2>
        <Link
          href="/dashboard/billing"
          className="text-[11px] font-semibold text-(--color-brand) hover:underline focus:outline-none focus:ring-2 focus:ring-(--color-brand)"
        >
          Billing →
        </Link>
      </div>

      <p className="mt-3 text-[22px] font-extrabold tracking-[-0.04em] text-(--color-text-900)">
        {used.toLocaleString("id-ID")}{" "}
        <span className="text-[13px] font-medium text-(--color-text-400)">
          / {limit.toLocaleString("id-ID")}
        </span>
      </p>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-(--color-bg-page)"
        role="progressbar"
        aria-label="Pemakaian kuota pesan"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(state.barPercent)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${BAR_COLOR[state.level]}`}
          style={{ width: `${state.barPercent}%` }}
        />
      </div>

      <p className="mt-2 text-[10.5px] font-medium text-(--color-text-500)">
        {planLabel} plan · sisa {state.remaining.toLocaleString("id-ID")} pesan
      </p>

      {/* Full quota: say what it means for customers */}
      {state.level === "full" && (
        <p className="mt-2 text-[11px] leading-snug text-(--color-danger)">
          KUN tidak bisa menjawab pesan baru.
        </p>
      )}

      {/* Upgrade shows up only when it is needed and possible, never as a permanent ad */}
      {isAdmin && state.canUpgrade && (
        <Link
          href="/dashboard/billing"
          className="btn-brand mt-3 flex h-9 w-full items-center justify-center text-[12px] font-semibold"
        >
          Upgrade paket
        </Link>
      )}
    </section>
  );
};

export default QuotaCard;
