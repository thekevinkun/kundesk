// Pure helper: picks a stable avatar look from a seed string (session id or user id)
// Same seed always gives the same look, so a customer keeps their face between renders

import type { AvatarLook, HairStyle } from "@/types/live-scene";

// Illustration colors — fixed on purpose, independent of the dashboard theme
const SKIN_TONES = [
  "#F6D5B8",
  "#E9B991",
  "#CC9266",
  "#A06A45",
  "#6E4529",
] as const;
const HAIR_COLORS = [
  "#2A1A10",
  "#4B2F1D",
  "#1B1B1F",
  "#7C4B24",
  "#8C919B",
] as const;
const SHIRT_COLORS = [
  "#4F8BF0",
  "#8B6CF0",
  "#E5733F",
  "#2FA67A",
  "#D95C8A",
] as const;
const HAIR_STYLES: readonly HairStyle[] = ["short", "long", "bun"];

// Exposed so tests can check every pick stays inside the palettes
export const AVATAR_PALETTES = {
  skin: SKIN_TONES,
  hair: HAIR_COLORS,
  shirt: SHIRT_COLORS,
  hairStyle: HAIR_STYLES,
} as const;

// Look used when there is no seed (no live conversation yet)
export const DEFAULT_LOOK: AvatarLook = {
  skin: SKIN_TONES[1],
  hair: HAIR_COLORS[0],
  shirt: SHIRT_COLORS[0],
  hairStyle: "short",
};

// Small deterministic string hash (FNV-1a) — identical on server and client, so no hydration mismatch
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    // Mix in each character, then multiply by the FNV prime
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Force an unsigned 32-bit number
  return hash >>> 0;
}

// Pick one item with wraparound — the fallback also satisfies noUncheckedIndexedAccess
function pick<T>(items: readonly T[], index: number, fallback: T): T {
  return items[index % items.length] ?? fallback;
}

// Main entry — different bit ranges of one hash so the four choices vary independently
export function getAvatarLook(seed: string | null | undefined): AvatarLook {
  if (!seed) return DEFAULT_LOOK;
  const hash = hashSeed(seed);
  return {
    skin: pick(SKIN_TONES, hash, DEFAULT_LOOK.skin),
    hair: pick(HAIR_COLORS, hash >>> 4, DEFAULT_LOOK.hair),
    shirt: pick(SHIRT_COLORS, hash >>> 8, DEFAULT_LOOK.shirt),
    hairStyle: pick(HAIR_STYLES, hash >>> 12, DEFAULT_LOOK.hairStyle),
  };
}

// Staff avatars never guess a gender: they have real names, so the hair is always the neutral crop
// Skin, hair color and shirt still come from the seed, so teammates look different from each other
export function getStaffLook(seed: string | null | undefined): AvatarLook {
  return { ...getAvatarLook(seed), hairStyle: "neutral" };
}
