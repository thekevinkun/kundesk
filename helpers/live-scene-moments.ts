// Pure data and geometry for the scene's moments: where things travel, what pops up, how long it lasts
// The same anchors draw the floor threads, so packets always ride the threads

import type {
  SceneAnchor,
  SceneEventKind,
  SceneMomentSpec,
  ScenePoint,
} from "@/types/live-scene";

// Platform centers in percent of the stage — threads and packets both use these
export const SCENE_ANCHORS: Record<SceneAnchor, ScenePoint> = {
  customer: { x: 18, y: 60.6 },
  kun: { x: 50, y: 57.1 },
  admin: { x: 82, y: 60.6 },
};

// Where each pop-up pill is centered — above heads, never over a face
export const POPUP_POSITIONS: Record<
  SceneAnchor,
  { left: number; top: number }
> = {
  customer: { left: 18, top: 8 },
  kun: { left: 68, top: 12 },
  admin: { left: 82, top: 8 },
};

// A packet takes this long per thread it crosses
export const SECONDS_PER_LEG = 0.9;
// The landing ring lasts this long after the packet arrives
export const RING_SECONDS = 0.7;

// "signal" = bright red dot for message traffic; amber stays for handoff, brand teal for pills and returns
export const SCENE_MOMENTS: Record<SceneEventKind, SceneMomentSpec> = {
  "customer-message-ai": {
    route: ["customer", "kun"],
    tone: "signal",
    popup: { text: "Pesan baru", anchor: "customer", tone: "brand" },
    announce: "Pesan baru dari pelanggan",
    durationMs: 1700,
  },
  "customer-message-admin": {
    route: ["customer", "kun", "admin"],
    tone: "signal",
    popup: { text: "Pesan baru", anchor: "admin", tone: "brand" },
    announce: "Pesan baru dari pelanggan untuk admin",
    durationMs: 2600,
  },
  "kun-reply": {
    route: ["kun", "customer"],
    tone: "signal",
    popup: null,
    announce: "KUN membalas pelanggan",
    durationMs: 1700,
  },
  // Later AI-mode messages: the dashboard only hears the reply, so the whole exchange plays at once
  "kun-exchange": {
    route: ["customer", "kun", "customer"],
    tone: "signal",
    popup: { text: "Pesan baru", anchor: "customer", tone: "brand" },
    announce: "Pelanggan bertanya dan KUN membalas",
    durationMs: 2700,
  },
  "admin-reply": {
    route: ["admin", "kun", "customer"],
    tone: "signal",
    popup: null,
    announce: "Admin membalas pelanggan",
    durationMs: 2600,
  },
  "handoff-requested": {
    route: ["kun", "admin"],
    tone: "warning",
    popup: { text: "Butuh admin!", anchor: "admin", tone: "warning" },
    announce: "Pelanggan meminta bantuan admin",
    durationMs: 2600,
  },
  takeover: {
    route: ["kun", "admin"],
    tone: "warning",
    popup: { text: "Admin mengambil alih", anchor: "admin", tone: "warning" },
    announce: "Admin mengambil alih percakapan",
    durationMs: 2600,
  },
  returned: {
    route: ["admin", "kun"],
    tone: "brand",
    popup: { text: "KUN kembali", anchor: "kun", tone: "brand" },
    announce: "KUN kembali menangani percakapan",
    durationMs: 2400,
  },
  "quota-warning": {
    route: null,
    tone: "warning",
    popup: { text: "Kuota 80%", anchor: "kun", tone: "warning" },
    announce: "Kuota pesan mencapai 80 persen",
    durationMs: 2800,
  },
  "quota-full": {
    route: null,
    tone: "danger",
    popup: { text: "Kuota penuh", anchor: "kun", tone: "danger" },
    announce: "Kuota pesan penuh",
    durationMs: 3200,
  },
};

// Keyframes for a packet crossing the route — one stop per anchor, evenly spaced in time
export function getPacketKeyframes(route: readonly SceneAnchor[]): {
  left: string[];
  top: string[];
  times: number[];
} {
  const points = route.map((anchor) => SCENE_ANCHORS[anchor]);
  // At least one leg, so a one-point route never divides by zero
  const legs = Math.max(points.length - 1, 1);
  return {
    left: points.map((point) => `${point.x}%`),
    top: points.map((point) => `${point.y}%`),
    times: points.map((_, index) => index / legs),
  };
}

// Total packet travel time in seconds
export function getPacketDurationSeconds(
  route: readonly SceneAnchor[],
): number {
  return SECONDS_PER_LEG * Math.max(route.length - 1, 1);
}
