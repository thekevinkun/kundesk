// All static config for the analytics page
// Colors, labels, chart display config — imported by analytics components only
// Nothing hardcoded in component files

import type { DeliveryChannel } from "@/types/chat";

// ── KPI card definitions — drives AnalyticsKpiStrip ──
// values are filled in at runtime — this is the display config only
export const KPI_CARDS = [
  {
    key: "totalConversations",
    label: "Total Percakapan",
    icon: "💬",
    iconBg: "bg-[#dbeafe] dark:bg-[#1e3a5f]",
    suffix: "",
  },
  {
    key: "resolutionRate",
    label: "Diselesaikan AI",
    icon: "✅",
    iconBg: "bg-[#d1fae5] dark:bg-[#14532d]",
    suffix: "%",
  },
  {
    key: "handoffRate",
    label: "Minta Bantuan Admin",
    icon: "🙋",
    iconBg: "bg-[#fef3c7] dark:bg-[#451a03]",
    suffix: "%",
  },
  {
    key: "avgResponseTime",
    label: "Avg. Response Time",
    icon: "⚡",
    iconBg: "bg-[#ede9fe] dark:bg-[#2e1065]",
    suffix: "",
  },
] as const;

// ── Channel display config — label + color per delivery channel ──
export const CHANNEL_CONFIG: Record<
  DeliveryChannel,
  { label: string; color: string; darkColor: string }
> = {
  web_widget: {
    label: "Web Widget",
    color: "#069494",
    darkColor: "#0ea5a5",
  },
  qr_link: {
    label: "QR / Link",
    color: "#60a5fa",
    darkColor: "#3b82f6",
  },
  whatsapp: {
    label: "WhatsApp",
    color: "#34d399",
    darkColor: "#10b981",
  },
};

// ── Hour labels for peak hours chart — 24h format with readable markers ──
export const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12am";
  if (i === 12) return "12pm";
  if (i < 12) return `${i}am`;
  return `${i - 12}pm`;
});

// ── Day period annotations — overlaid on peak hours chart ──
export const DAY_PERIODS = [
  { label: "Dini Hari", start: 0, end: 5 },
  { label: "Pagi", start: 6, end: 11 },
  { label: "Siang", start: 12, end: 17 },
  { label: "Malam", start: 18, end: 23 },
] as const;

// ── Handoff insight copy — shown below the handoff donut ──
// Threshold-based messaging — tells owner how to interpret the number
export function getHandoffInsightCopy(handoffRate: number): {
  headline: string;
  detail: string;
  sentiment: "good" | "warn" | "alert";
} {
  if (handoffRate === 0) {
    return {
      headline: "AI menangani semua percakapan",
      detail:
        "Tidak ada pelanggan yang meminta bantuan admin bulan ini. Chatbot kamu bekerja sangat baik.",
      sentiment: "good",
    };
  }
  if (handoffRate < 5) {
    return {
      headline: "Tingkat handoff rendah — bagus",
      detail: `${handoffRate}% pelanggan meminta bantuan langsung. Ini normal dan sehat — berarti AI menangani pertanyaan umum dengan baik.`,
      sentiment: "good",
    };
  }
  if (handoffRate < 15) {
    return {
      headline: "Perlu perhatian — tambah dokumen",
      detail: `${handoffRate}% pelanggan tidak puas dengan jawaban AI. Coba upload lebih banyak dokumen atau perluas FAQ kamu.`,
      sentiment: "warn",
    };
  }
  return {
    headline: "Tingkat handoff tinggi — perlu tindakan",
    detail: `${handoffRate}% pelanggan meminta admin. AI kamu kekurangan informasi — segera perbarui dokumen dan FAQ.`,
    sentiment: "alert",
  };
}

// ── Sentiment color map — used by HandoffInsightCard ──
export const SENTIMENT_COLORS = {
  good: {
    bg: "bg-transparent dark:bg-emerald/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: "✓",
  },
  warn: {
    bg: "bg-transparent dark:bg-amber/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    icon: "⚠",
  },
  alert: {
    bg: "bg-transparent dark:bg-red/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    icon: "✕",
  },
} as const;
