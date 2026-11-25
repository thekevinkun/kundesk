// Pure helper: turns live dashboard data into the poses and labels the scene draws
// No React, Clerk or Pusher in here — so every rule can be unit-tested

import type { LiveConversationPreview } from "@/types/dashboard";
import type {
  AdminOwnership,
  QuotaLevel,
  SceneInput,
  SceneMode,
  SceneState,
} from "@/types/live-scene";

// Same 80% threshold as the server's quota_warning notification
const QUOTA_WARNING_PERCENT = 80;

// Quota level from used/limit — integer math, so the 80% edge never rounds wrong
export function getQuotaLevel(used: number, limit: number): QuotaLevel {
  // A zero or missing limit cannot be "full" — avoids dividing by zero
  if (limit <= 0) return "ok";
  // At or over the limit KUN can no longer answer customers
  if (used >= limit) return "full";
  // used / limit >= 80%, written without division
  if (used * 100 >= limit * QUOTA_WARNING_PERCENT) return "warning";
  return "ok";
}

// Customer-facing channel name — unknown values fall back to a neutral label
export function getChannelLabel(channel: string): string {
  switch (channel) {
    case "whatsapp":
      return "WhatsApp";
    case "qr_link":
      return "QR";
    case "web_widget":
      return "Web";
    default:
      return "Chat";
  }
}

// Handoff status from the database → scene mode (missing preview means KUN's default mode)
function getMode(
  handoffStatus: LiveConversationPreview["handoffStatus"] | undefined,
): SceneMode {
  if (handoffStatus === "pending_handoff") return "pending";
  if (handoffStatus === "human") return "manual";
  return "ai";
}

// Same wording the workspace already showed — pending wins, then manual, then KUN's state
function getStatusLabel(mode: SceneMode, botActive: boolean): string {
  if (mode === "pending") return "Menunggu admin mengambil alih";
  if (mode === "manual") return "Admin menangani percakapan";
  return botActive ? "KUN menangani percakapan" : "KUN sedang nonaktif";
}

// Name and ownership shown at the admin desk
function getAdmin(
  mode: SceneMode,
  takenOverBy: string | null,
  viewerUserId: string | null,
  viewerName: string | null,
): { name: string; ownership: AdminOwnership } {
  // The desk belongs to whoever is looking at the dashboard until someone takes over
  const viewerLabel = viewerName ?? "Admin";
  // takenOverBy can be stale after a return to KUN — only trust it in manual mode
  if (mode !== "manual") return { name: viewerLabel, ownership: "none" };
  // Manual mode but nobody recorded — never guess a name
  if (!takenOverBy) return { name: "Staf", ownership: "unknown" };
  // The logged-in user took over
  if (viewerUserId && takenOverBy === viewerUserId) {
    return { name: `${viewerLabel} (Anda)`, ownership: "viewer" };
  }
  // Someone else took over — never show the viewer's name for their work
  return { name: "Staf lain", ownership: "other" };
}

// Main entry — one pure function from data to everything the scene needs
export function deriveSceneState(input: SceneInput): SceneState {
  const {
    preview,
    botActive,
    quotaUsed,
    quotaLimit,
    viewerUserId,
    viewerName,
  } = input;
  const mode = getMode(preview?.handoffStatus);
  const quotaLevel = getQuotaLevel(quotaUsed, quotaLimit);
  const admin = getAdmin(
    mode,
    preview?.takenOverBy ?? null,
    viewerUserId,
    viewerName,
  );

  return {
    mode,
    statusLabel: getStatusLabel(mode, botActive),
    quotaLevel,
    // An inactive KUN is off regardless of quota; a full quota makes an active KUN tired
    kunPose: !botActive ? "off" : quotaLevel === "full" ? "tired" : "active",
    // No conversation in the last 24h means nobody is at the customer spot
    customerPose: !preview ? "absent" : mode === "pending" ? "waiting" : "idle",
    adminPose:
      mode === "pending" ? "alerted" : mode === "manual" ? "working" : "idle",
    channelLabel: preview ? getChannelLabel(preview.deliveryChannel) : null,
    sessionLabel: preview ? `#${preview.sessionId.slice(0, 8)}` : null,
    adminName: admin.name,
    adminOwnership: admin.ownership,
  };
}
