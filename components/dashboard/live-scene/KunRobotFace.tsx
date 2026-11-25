"use client";

// What KUN shows on his visor: smiling eyes and mouth when active, sleepy when the quota is full, flat when off

import { motion } from "framer-motion";
import { getKunPalette } from "@/helpers/kun-robot-palette";
import { sceneBlinkVariants } from "@/lib/animations";
import type { KunRobotProps } from "@/types/live-scene";

const KunRobotFace = ({ pose, animated }: KunRobotProps) => {
  // Face lines are drawn in the palette's glow color
  const { mark } = getKunPalette(pose);

  // Off: two flat dashes, no mouth
  if (pose === "off") {
    return (
      <path
        d="M50 57 L64 57 M76 57 L90 57"
        stroke={mark}
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
    );
  }

  // Tired: half-closed eyes and a flat mouth
  if (pose === "tired") {
    return (
      <>
        <path
          d="M50 58 Q57 55 64 58 M76 58 Q83 55 90 58"
          stroke={mark}
          strokeWidth={3.4}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M62 68 L78 68"
          stroke={mark}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </>
    );
  }

  // Active: smiling arcs that blink, plus a filled smile
  return (
    <>
      <motion.path
        d="M49 56 Q57 46 65 56 M75 56 Q83 46 91 56"
        stroke={mark}
        strokeWidth={3.6}
        strokeLinecap="round"
        fill="none"
        variants={sceneBlinkVariants}
        initial={false}
        animate={animated ? "blink" : "open"}
        style={{ originX: 0.5, originY: 0.5 }}
      />
      <path
        d="M59 64 Q70 77 81 64 Q70 70 59 64 Z"
        fill={mark}
        stroke={mark}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </>
  );
};

export default KunRobotFace;
