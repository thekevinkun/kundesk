// Pure rules for the "Kesehatan Operasional" card
// The donut measures how many conversations finished without staff — not the same number as Auto-Bot,
// which counts answered messages

import type { getQuotaUsageLevel } from "@/helpers/dashboard-priorities";

export interface HandoffFreeSummary {
  // Whole percent, rounded DOWN so 100% only ever means "no handoff at all"
  percent: number;
  withoutStaff: number;
  total: number;
}

// Returns null when there are no conversations yet — there is nothing to measure
export function getHandoffFreeSummary(
  totalConversations: number,
  handoffConversations: number,
): HandoffFreeSummary | null {
  if (totalConversations <= 0) return null;
  // Clamp: a handoff count above the total (data drift) must not produce a negative share
  const handedOff = Math.min(
    Math.max(handoffConversations, 0),
    totalConversations,
  );
  const withoutStaff = totalConversations - handedOff;
  return {
    percent: Math.floor((withoutStaff * 100) / totalConversations),
    withoutStaff,
    total: totalConversations,
  };
}

interface HealthLabelInput {
  pendingHandoffCount: number;
  quotaLevel: ReturnType<typeof getQuotaUsageLevel>;
  botActive: boolean;
}

// One sentence under the title — the first problem found wins, in the order it matters
export function getHealthLabel(input: HealthLabelInput): string {
  if (input.pendingHandoffCount > 0) return "Ada handoff yang perlu ditangani";
  if (input.quotaLevel !== "ok") return "Kuota perlu diperhatikan";
  if (input.botActive) return "Operasional berjalan normal";
  return "KUN sedang nonaktif";
}
