// Pure rule behind "Prioritas Sekarang": which real states need the owner, in what order
// Kept out of the component so every threshold and the member/admin split are tested

import type {
  PriorityInput,
  PriorityItem,
  PriorityResult,
} from "@/types/dashboard";

// The card shows this many items first; the rest sit behind "Lihat N lainnya"
export const PRIORITY_VISIBLE_COUNT = 3;

// Same thresholds as the live scene's quota pop-ups: warning from 80%, full at 100%
const QUOTA_WARNING_PERCENT = 80;

// Integer math only, so 79.99 never rounds into a warning. A zero limit is never a problem.
export function getQuotaUsageLevel(
  used: number,
  limit: number,
): "ok" | "warning" | "full" {
  if (limit <= 0) return "ok";
  if (used >= limit) return "full";
  if (used * 100 >= limit * QUOTA_WARNING_PERCENT) return "warning";
  return "ok";
}

// Whole percent for display text, never above 100
function quotaPercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.floor((Math.min(used, limit) * 100) / limit);
}

// Builds the ordered list of things that need attention
export function deriveDashboardPriorities(
  input: PriorityInput,
): PriorityResult {
  const items: PriorityItem[] = [];

  // 1. A customer waiting for staff — the only item members see
  if (input.pendingHandoffCount > 0) {
    items.push({
      id: "pending-handoff",
      tone: "danger",
      title: `${input.pendingHandoffCount} handoff menunggu`,
      detail: "Pelanggan menunggu respons staff di ruang Percakapan.",
      href: "/dashboard/conversations",
    });
  }

  if (input.isAdmin) {
    // 2. Unpaid renewal — the plan drops to Free if it stays unpaid
    if (input.subscriptionStatus === "past_due") {
      items.push({
        id: "payment-past-due",
        tone: "danger",
        title: "Pembayaran jatuh tempo",
        detail: "Selesaikan pembayaran agar paketmu tidak turun ke Free.",
        href: "/dashboard/billing",
      });
    }

    // 3 and 5. Quota: full outranks everything below it, the warning ranks after "KUN nonaktif"
    const quotaLevel = getQuotaUsageLevel(input.quotaUsed, input.quotaLimit);
    if (quotaLevel === "full") {
      items.push({
        id: "quota-full",
        tone: "danger",
        title: "Kuota pesan habis",
        detail: "KUN tidak bisa menjawab pesan baru sampai kuota diperbarui.",
        href: "/dashboard/billing",
      });
    }

    // 4. KUN switched off (or never created) — customers get no automatic answers
    if (!input.botActive) {
      items.push({
        id: "kun-inactive",
        tone: "warning",
        title: "Aktifkan KUN",
        detail: "KUN sedang tidak melayani chat otomatis.",
        href: "/dashboard/chatbot",
      });
    }

    if (quotaLevel === "warning") {
      items.push({
        id: "quota-warning",
        tone: "warning",
        title: "Periksa kuota pesan",
        detail: `${quotaPercent(input.quotaUsed, input.quotaLimit)}% kuota pesan telah digunakan.`,
        href: "/dashboard/billing",
      });
    }

    // 6. Documents KUN could not read
    if (input.failedDocumentCount > 0) {
      items.push({
        id: "documents-failed",
        tone: "warning",
        title: `${input.failedDocumentCount} dokumen gagal diproses`,
        detail:
          "KUN belum bisa belajar dari dokumen ini. Buka Info Bisnis untuk memeriksanya.",
        href: "/dashboard/knowledge",
      });
    }

    // 7. Edits that have not reached KUN yet
    if (input.staleEntryCount > 0) {
      items.push({
        id: "knowledge-stale",
        tone: "warning",
        title: `${input.staleEntryCount} entri belum tersinkron`,
        detail:
          "Perubahan terakhir belum sampai ke KUN. Buka Info Bisnis untuk mencoba lagi.",
        href: "/dashboard/knowledge",
      });
    }
  }

  return {
    items,
    // A member cannot see billing or KUN state, so the calm message claims only what they can verify
    allClear: {
      title: "Tidak ada tindakan mendesak",
      detail: input.isAdmin
        ? "KUN aktif, tidak ada handoff tertunda, dan kuota masih aman."
        : "Tidak ada handoff tertunda saat ini.",
    },
  };
}
