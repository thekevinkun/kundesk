"use client";

import type { BillingPageData, PlanName } from "@/types/billing";
import { CurrentPlanCard, PlanCard, CancelDialog } from "./billing";

interface BillingPageProps {
  data: BillingPageData;
}

const BillingPage = ({ data }: BillingPageProps) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-(--color-text-900) leading-none mb-1">
          Billing
        </h1>
        <p className="text-sm text-(--color-text-500)">
          Kelola plan dan langganan bisnis kamu
        </p>
      </div>

      {/* Current plan status card */}
      <CurrentPlanCard data={data} />

      {/* Plan selection grid */}
      <div>
        <h2 className="text-base font-semibold text-(--color-text-900) mb-1">
          Pilih Plan
        </h2>
        <p className="text-xs text-(--color-text-500) mb-4">
          Upgrade atau ganti plan kapan saja. Berlaku langsung setelah
          pembayaran.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {(["free", "starter", "pro"] as PlanName[]).map((plan) => (
            <PlanCard
              key={plan}
              plan={plan}
              currentPlan={data.currentPlan}
              subscriptionStatus={data.subscriptionStatus}
            />
          ))}
        </div>
      </div>

      {/* Cancel link — only for paying subscribers who haven't already cancelled */}
      {data.currentPlan !== "free" &&
        data.subscriptionStatus !== "cancelled" && (
          <div className="flex items-center justify-end pt-2">
            <CancelDialog currentPlan={data.currentPlan} />
          </div>
        )}

      {/* Payment security note */}
      <div className="p-4 rounded-(--radius-sm) bg-(--color-bg-page) border border-(--color-border-sm) flex items-start gap-3">
        <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">
          🔒
        </span>
        <div>
          <p className="text-xs font-semibold text-(--color-text-700) mb-1">
            Pembayaran aman via Midtrans
          </p>
          <p className="text-xs text-(--color-text-400) leading-relaxed">
            Kami mendukung Transfer Bank (BCA, Mandiri, BNI, BRI), GoPay, QRIS,
            OVO, dan DANA. Tidak ada biaya tersembunyi. Tagihan dalam Rupiah.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
