// Types for the live conversation scene — shared by the state helper and the scene components

import type { LiveConversationPreview } from "@/types/dashboard";

// Who is handling the live conversation right now
export type SceneMode = "ai" | "pending" | "manual";

// Monthly quota level — warning from 80%, full at 100%
export type QuotaLevel = "ok" | "warning" | "full";

// Poses are plain strings — each avatar maps them to its own drawing later
export type KunPose = "off" | "active" | "tired";
export type CustomerPose = "absent" | "idle" | "waiting";
export type AdminPose = "idle" | "alerted" | "working";

// Whose desk the admin avatar shows:
// viewer = the logged-in user took over, other = another staff member,
// unknown = manual mode but no taker recorded, none = nobody has taken over
export type AdminOwnership = "viewer" | "other" | "unknown" | "none";

// Everything the helper needs — all of it already exists in the dashboard
export interface SceneInput {
  preview: Pick<
    LiveConversationPreview,
    "sessionId" | "deliveryChannel" | "handoffStatus" | "takenOverBy"
  > | null;
  botActive: boolean;
  quotaUsed: number;
  quotaLimit: number;
  viewerUserId: string | null;
  viewerName: string | null;
}

// What the scene draws — derived, never stored
export interface SceneState {
  mode: SceneMode;
  statusLabel: string;
  quotaLevel: QuotaLevel;
  kunPose: KunPose;
  customerPose: CustomerPose;
  adminPose: AdminPose;
  channelLabel: string | null;
  sessionLabel: string | null;
  adminName: string;
  adminOwnership: AdminOwnership;
}
