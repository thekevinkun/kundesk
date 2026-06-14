"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";

import { cancelPendingPaymentAction } from "@/lib/actions/billing";
import { PLAN_CONFIG } from "@/components/dashboard/billing/constants";
import { formatRupiah } from "@/helpers/format";
import type { PendingPayment } from "@/types/billing";

interface PendingPaymentBannerProps {
  pendingPayment: PendingPayment;
}

// Shown on /billing when an org has an unfinished payment <24h old
// Lets the customer resume the same Midtrans Snap session instead of
// hitting the "transaksi sudah dibuat" dead-end
const PendingPaymentBanner = ({
  pendingPayment,
}: PendingPaymentBannerProps) => {
  const planLabel = PLAN_CONFIG[pendingPayment.plan].label;
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelPendingPaymentAction();
      if (result.success) {
        toast.success("Transaksi dibatalkan. Kamu bisa memilih plan lain.");
      }
    });
  };

  return (
    <div
      role="status"
      // aria-live so screen readers announce this on page load — matches
      // the project's pattern for dynamic status content
      aria-live="polite"
      className="mb-6 px-4 py-3 rounded-(--radius-sm) bg-amber-500/10
        border border-amber-700/30 flex items-center justify-between
        gap-3 flex-wrap"
    >
      <div className="flex items-start gap-3">
        <span
          className="font-bold text-base flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          ⏳
        </span>
        <div>
          <p className="text-[12px] font-semibold text-amber-600 mb-1">
            Pembayaran belum selesai
          </p>
          <p className="text-[12px] text-(--color-text-700) leading-relaxed">
            Kamu punya transaksi {planLabel} senilai{" "}
            {formatRupiah(pendingPayment.amount)} yang belum dibayar. Selesaikan
            sekarang sebelum link kedaluwarsa.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="py-2 px-4 rounded-(--radius-full) text-xs font-bold
            text-(--color-text-500) hover:text-(--color-danger)
            transition-all duration-200 whitespace-nowrap disabled:opacity-50"
        >
          Batalkan
        </button>

        <Link
          href={pendingPayment.redirectUrl}
          className="flex-shrink-0 py-2 px-4 rounded-(--radius-full) text-xs
            font-bold bg-(--color-brand)/80 text-white hover:bg-(--color-brand)
            transition-all duration-200 whitespace-nowrap"
        >
          Lanjutkan Pembayaran
        </Link>
      </div>
    </div>
  );
};

export default PendingPaymentBanner;
