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
  // First name of another staff member who took over — resolved on the server
  takenOverByName?: string | null | undefined;
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

// ── Avatar and scene component types ──

// Hair shapes the people avatars can draw
export type HairStyle = "short" | "long" | "bun";

// Face mood for a person avatar
export type SceneMood = "calm" | "worried" | "alert";

// Colors and hair shape of a person avatar — derived from a seed, never stored
export interface AvatarLook {
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: HairStyle;
}

// Props shared by every animated scene character
export interface SceneActorProps {
  // False under prefers-reduced-motion — poses stay, movement stops
  animated: boolean;
}

export interface PersonBustProps extends SceneActorProps {
  look: AvatarLook;
  mood: SceneMood;
}

export interface CustomerAvatarProps extends SceneActorProps {
  pose: CustomerPose;
  look: AvatarLook;
}

export interface AdminAvatarProps extends SceneActorProps {
  pose: AdminPose;
  look: AvatarLook;
}

export interface KunRobotProps extends SceneActorProps {
  pose: KunPose;
}

export interface IsoPlatformProps {
  // Horizontal center of the tile inside the SVG viewBox
  cx: number;
  // Y of the tile's top corner
  top: number;
  // Tailwind stroke class so each character tints its own tile
  strokeClass: string;
}

// ── Scene moments: what happens on stage when something real happens ──

// Every real event the scene can react to — the store, the queue and the moment table all use this
export type SceneEventKind =
  | "customer-message-ai"
  | "customer-message-admin"
  | "kun-reply"
  | "kun-exchange"
  | "admin-reply"
  | "handoff-requested"
  | "takeover"
  | "returned"
  | "quota-warning"
  | "quota-full";

// The three places on stage things travel between
export type SceneAnchor = "customer" | "kun" | "admin";

// A position on the stage in percent of its width and height
export interface ScenePoint {
  x: number;
  y: number;
}

// Color family of a packet or pop-up
export type SceneTone = "brand" | "warning" | "danger" | "signal";

export interface ScenePopupSpec {
  text: string;
  anchor: SceneAnchor;
  tone: SceneTone;
}

// Recipe for one kind of moment
export interface SceneMomentSpec {
  // Anchors the packet visits in order — null means no packet
  route: readonly SceneAnchor[] | null;
  tone: SceneTone;
  popup: ScenePopupSpec | null;
  // Read aloud by screen readers
  announce: string;
  // How long the moment holds the stage before the next one starts
  durationMs: number;
}

// One queued or playing moment — id comes from the store's event counter
export interface SceneMoment {
  id: number;
  kind: SceneEventKind;
}

// Queue state kept by the pure queue helper
export interface SceneQueueState {
  queue: SceneMoment[];
  last: { kind: SceneEventKind; at: number } | null;
}

export interface SceneMomentLayerProps extends SceneActorProps {
  moment: SceneMoment | null;
}
