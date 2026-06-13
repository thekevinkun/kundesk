"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface PaymentResultBannerProps {
  // Raw Midtrans transaction_status from the redirect query param
  transactionStatus: string;
}

// One-time banner shown immediately after returning from the Midtrans Snap
// page. Strips the query param on mount so a refresh shows a clean page —
// the persistent PendingPaymentBanner takes over for ongoing pending state.
const PaymentResultBanner = ({
  transactionStatus,
}: PaymentResultBannerProps) => {
  const router = useRouter();

  // Strip the query param after first render — banner won't reappear on refresh
  useEffect(() => {
    router.replace("/dashboard/billing");
  }, [router]);

  // Map Midtrans status → display variant
  let variant: "success" | "pending" | "failed";
  let icon: string;
  let title: string;
  let message: string;

  if (transactionStatus === "settlement" || transactionStatus === "capture") {
    variant = "success";
    icon = "🎉";
    title = "Pembayaran berhasil";
    message =
      "Terima kasih! Plan kamu akan aktif dalam beberapa saat. Konfirmasi juga dikirim ke email kamu.";
  } else if (transactionStatus === "pending") {
    variant = "pending";
    icon = "⏳";
    title = "Pembayaran sedang diproses";
    message =
      "Selesaikan pembayaran sesuai instruksi yang diberikan. Plan kamu akan aktif otomatis setelah pembayaran dikonfirmasi.";
  } else {
    // deny, cancel, expire, or anything unrecognized
    variant = "failed";
    icon = "✕";
    title = "Pembayaran tidak berhasil";
    message =
      "Transaksi dibatalkan atau gagal. Tidak ada biaya yang dikenakan — kamu bisa mencoba lagi kapan saja.";
  }

  const variantClasses = {
    success: "bg-(--color-success)/10 border-(--color-success)/30",
    pending: "bg-amber-500/10 border-amber-700/30",
    failed: "bg-(--color-danger)/10 border-(--color-danger)/30",
  };

  const titleClasses = {
    success: "text-(--color-success)",
    pending: "text-amber-600",
    failed: "text-(--color-danger)",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 px-4 py-3 rounded-(--radius-sm) border flex items-start gap-3 ${variantClasses[variant]}`}
    >
      <span className={`font-bold text-base flex-shrink-0 ${titleClasses[variant]}`} aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className={`text-[12px] font-semibold mb-1 ${titleClasses[variant]}`}>
          {title}
        </p>
        <p className="text-[12px] text-(--color-text-700) leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
};

export default PaymentResultBanner;
