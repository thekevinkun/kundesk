// Pure state of the "Kuota Pesan" card: how full it is, what is left, and whether upgrading makes sense
// Thresholds come from the shared quota rule, so the card, the live scene and "Prioritas Sekarang" agree

import { getQuotaUsageLevel } from "@/helpers/dashboard-priorities";

export interface QuotaCardState {
  level: "ok" | "warning" | "full";
  // 0–100, not rounded — drives the bar width smoothly
  barPercent: number;
  remaining: number;
  // An upgrade only helps when it is needed and a bigger plan exists (Pro is the top plan)
  canUpgrade: boolean;
}

export function getQuotaCardState(
  used: number,
  limit: number,
  plan: "free" | "starter" | "pro",
): QuotaCardState {
  const level = getQuotaUsageLevel(used, limit);
  // A zero or negative limit shows an empty bar rather than dividing by zero
  const barPercent =
    limit <= 0 ? 0 : Math.min(Math.max((used * 100) / limit, 0), 100);
  return {
    level,
    barPercent,
    // Never negative, even when usage overshoots the limit
    remaining: Math.max(limit - used, 0),
    canUpgrade: plan !== "pro" && level !== "ok",
  };
}
