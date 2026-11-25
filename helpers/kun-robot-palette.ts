// Pure helper: the colors KUN wears in each pose
// Fixed on purpose — the robot has his own look and ignores the org accent color

import type { KunPalette, KunPose } from "@/types/live-scene";

// Gradient ids are defined once in KunRobotDefs and referenced here, so the two cannot drift apart
export const KUN_GRADIENTS = {
  goldBody: "kun-gold-body",
  goldDark: "kun-gold-dark",
  visor: "kun-visor",
  steelBody: "kun-steel-body",
  steelDark: "kun-steel-dark",
  visorOff: "kun-visor-off",
} as const;

// SVG paint reference to a gradient id
const ref = (id: string): string => `url(#${id})`;

// An active or tired KUN is gold; an inactive one turns steel grey and a little dimmer
export function getKunPalette(pose: KunPose): KunPalette {
  if (pose === "off") {
    return {
      body: ref(KUN_GRADIENTS.steelBody),
      dark: ref(KUN_GRADIENTS.steelDark),
      visor: ref(KUN_GRADIENTS.visorOff),
      edge: "#6E7787",
      mark: "#9AA3B4",
      tileClass: "stroke-(--color-border)",
      opacity: 0.9,
    };
  }
  return {
    body: ref(KUN_GRADIENTS.goldBody),
    dark: ref(KUN_GRADIENTS.goldDark),
    visor: ref(KUN_GRADIENTS.visor),
    edge: "#B8741A",
    mark: "#FFD45E",
    tileClass: "stroke-[#E7A92C]",
    opacity: 1,
  };
}
