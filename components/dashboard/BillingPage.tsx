"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CurrentPlanCard,
  PlanCard,
  CancelDialog,
  PaymentHistoryCard,
  PromoCodeInput,
  PendingPaymentBanner,
  PaymentResultBanner,
} from "@/components/dashboard/billing";
import { fadeUp } from "@/lib/animations";
import type { BillingPageData, PlanName } from "@/types/billing";

interface BillingPageProps {
  data: BillingPageData;
  transactionStatus: string | null;
}

const BillingPage = ({ data, transactionStatus }: BillingPageProps) => {
  const [promoCode, setPromoCode] = useState<string | null>(null);

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center"
    >
      <div className="space-y-6 w-full max-w-5xl mx-auto">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-(--color-text-900) leading-none mb-1">
            Billing
          </h1>
          <p className="text-sm text-(--color-text-500)">
            Kelola plan dan langganan bisnis kamu
          </p>
        </div>

        {/* One-time result banner — only present right after Midtrans redirect */}
        {transactionStatus && (
          <PaymentResultBanner transactionStatus={transactionStatus} />
        )}

        {/* Persistent "resume payment" banner — shown while a pending row exists */}
        {data.pendingPayment && (
          <PendingPaymentBanner pendingPayment={data.pendingPayment} />
        )}

        {/* Current plan status card */}
        <CurrentPlanCard data={data} />

        {/* Plan selection grid */}
        <div className="md:mb-16">
          <h2 className="text-base font-semibold text-(--color-text-900) mb-1">
            Pilih Plan
          </h2>
          <p className="text-xs text-(--color-text-500) mb-4">
            Upgrade atau ganti plan kapan saja. Berlaku langsung setelah
            pembayaran.
          </p>

          {/* Payment security note */}
          <div
            className="mb-9 px-2 py-3 rounded-(--radius-sm) bg-gray-400/15
          border border-(--color-border-sm) flex items-start gap-3"
          >
            <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">
              🔒
            </span>
            <div>
              <p className="text-xs font-semibold text-(--color-text-700) mb-1">
                Pembayaran aman via Midtrans
              </p>
              <p className="text-xs text-(--color-text-500) leading-relaxed">
                Kami mendukung Transfer Bank (BCA, Mandiri, BNI, BRI), GoPay,
                QRIS, OVO, dan DANA. Tidak ada biaya tersembunyi. Tagihan dalam
                Rupiah.
              </p>
            </div>
          </div>

          {/* Promo code input — only shown when at least one active promo exists */}
          {data.hasActivePromo && <PromoCodeInput onApply={setPromoCode} />}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {(["free", "starter", "pro"] as PlanName[]).map((plan) => (
              <PlanCard
                key={plan}
                plan={plan}
                currentPlan={data.currentPlan}
                subscriptionStatus={data.subscriptionStatus}
                hasUsedFirstPurchase={data.hasUsedFirstPurchase}
                promoCode={promoCode}
              />
            ))}
          </div>
        </div>

        {/* Cancel link — only for paying subscribers who haven't already cancelled */}
        {data.currentPlan !== "free" &&
          data.subscriptionStatus !== "cancelled" && (
            <div className="flex items-center justify-end">
              <CancelDialog currentPlan={data.currentPlan} />
            </div>
          )}

        {/* Payment history — real data from payments table */}
        <PaymentHistoryCard history={data.paymentHistory} />
      </div>
    </motion.div>
  );
};

export default BillingPage;
