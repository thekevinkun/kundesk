// UI-only config for plan cards — labels, icons, feature lists, colors
// Separate from types/billing.ts (which owns PlanName, PLAN_LIMITS, PLAN_PRICE)
// This is presentation data — only imported by billing UI components

import type { PlanName, SubscriptionStatus } from "@/types/billing";

export interface PlanUIConfig {
  label: string;
  desc: string;
  color: string; // icon background Tailwind class
  icon: string;
  features: string[];
  unavailable: string[];
}

export const PLAN_CONFIG: Record<PlanName, PlanUIConfig> = {
  free: {
    label: "Free",
    desc: "Coba KUN gratis untuk bisnis yang baru mulai",
    color: "bg-(--color-bg-page)",
    icon: "🌱",
    features: [
      "100 pesan / bulan",
      "3 dokumen upload",
      "1 chatbot",
      "QR Code + link publik",
    ],
    unavailable: [
      "Embed widget",
      "Analytics dashboard",
      "Custom branding",
      "API access",
    ],
  },
  starter: {
    label: "Starter",
    desc: "KUN siap melayani pelanggan bisnis kamu 24/7",
    color: "bg-(--color-brand-light)",
    icon: "⚡",
    features: [
      "1.000 pesan / bulan",
      "20 dokumen upload",
      "1 chatbot",
      "QR Code + link publik",
      "Embed widget",
      "Analytics dasar",
    ],
    unavailable: ["Custom branding", "API access"],
  },
  pro: {
    label: "Pro",
    desc: "KUN untuk bisnis besar atau agensi dengan banyak klien",
    color: "bg-(--color-brand-light)",
    icon: "🚀",
    features: [
      "10.000 pesan / bulan",
      "Dokumen unlimited",
      "3 chatbot",
      "QR Code + link publik",
      "Embed widget",
      "Analytics lengkap",
      "Custom branding",
      "API access",
    ],
    unavailable: [],
  },
};

// Human-readable labels for Midtrans payment_type values
// Used in PlanUpgradedEmail receipt and PaymentHistoryCard
// bank_transfer is the generic value Midtrans sends for VA settlements —
// the *_va entries are kept for forward-compatibility but rarely seen directly
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Transfer Bank",
  qris: "QRIS",
  other_qris: "QRIS",
  credit_card: "Kartu Kredit/Debit",
  bca_va: "BCA Virtual Account",
  bni_va: "BNI Virtual Account",
  bri_va: "BRI Virtual Account",
  permata_va: "Permata Virtual Account",
  echannel: "Mandiri Virtual Account",
  cimb_va: "CIMB Niaga Virtual Account",
  danamon_va: "Danamon Virtual Account",
  bsi_va: "BSI Virtual Account",
  seabank_va: "SeaBank Virtual Account",
  saqu_va: "Bank Saqu Virtual Account",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  dana: "DANA",
  ovo: "OVO",
  indomaret: "Indomaret",
  alfamart: "Alfamart Group",
  kredivo: "Kredivo",
  akulaku: "Akulaku",
};

// Helper — falls back to the raw value if not in the map
export function getPaymentMethodLabel(paymentType: string | null): string {
  if (!paymentType) return "—";
  return PAYMENT_METHOD_LABELS[paymentType] ?? paymentType;
}

// Maps subscriptionStatus to display label + badge class
export function getStatusDisplay(status: SubscriptionStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "active":
      return { label: "Aktif", className: "badge-base badge-success" };
    case "past_due":
      return {
        label: "Tagihan Jatuh Tempo",
        className: "badge-base badge-warning",
      };
    case "suspended":
      return { label: "Disuspend", className: "badge-base badge-danger" };
    case "cancelled":
      return { label: "Dibatalkan", className: "badge-base badge-danger" };
    case "free":
    default:
      return {
        label: "Gratis",
        className: "badge-base badge-brand text-(--color-brand)",
      };
  }
}
