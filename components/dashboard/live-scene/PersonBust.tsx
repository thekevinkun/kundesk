"use client";

// Shared head-and-shoulders drawing for the customer and the admin
// Drawn in a 120-wide viewBox with the face centered on x = 60

import { motion } from "framer-motion";
import { sceneBlinkVariants } from "@/lib/animations";
import type { HairStyle, PersonBustProps, SceneMood } from "@/types/live-scene";

// Mouth shape per mood
const MOUTHS: Record<SceneMood, string> = {
  calm: "M55 84 Q60 88 65 84",
  worried: "M55 86 Q60 82 65 86",
  alert: "M57 85 L63 85",
};

// Hair on top of the head per style — "neutral" is the soft crop staff always wear
const SHORT_CAP =
  "M41 72 C41 56 49 51 60 51 C71 51 79 56 79 72 C75 64 69 61 60 61 C51 61 45 64 41 72 Z";
const HAIR_CAPS: Record<HairStyle, string> = {
  short: SHORT_CAP,
  long: SHORT_CAP,
  bun: SHORT_CAP,
  neutral:
    "M40 76 C38 56 48 49 60 49 C72 49 82 56 80 76 C78 68 76 64 72 62 C66 64 56 63 48 58 C45 62 42 68 40 76 Z",
};

// Eye and mouth ink — fixed, readable on every skin tone
const INK = "#1b1b1f";

const PersonBust = ({ look, animated, mood }: PersonBustProps) => (
  <g>
    {/* Shoulders and torso */}
    <path
      d="M30 130 C30 108 44 98 60 98 C76 98 90 108 90 130 Z"
      fill={look.shirt}
    />
    {/* Neck */}
    <rect x={54} y={88} width={12} height={14} rx={5} fill={look.skin} />
    {/* Collar shadow */}
    <path
      d="M52 100 Q60 108 68 100"
      fill="none"
      stroke="rgba(0,0,0,0.18)"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* Long hair falls behind the head and shoulders */}
    {look.hairStyle === "long" && (
      <path
        d="M41 72 C38 92 42 100 48 102 L72 102 C78 100 82 92 79 72 Z"
        fill={look.hair}
      />
    )}
    {/* Head */}
    <circle cx={60} cy={74} r={18} fill={look.skin} />
    {/* Hair on top of the head */}
    <path d={HAIR_CAPS[look.hairStyle]} fill={look.hair} />
    {/* Bun sits above the hair */}
    {look.hairStyle === "bun" && (
      <circle cx={60} cy={48} r={7} fill={look.hair} />
    )}
    {/* Eyes blink together; bigger when alert */}
    <motion.g
      variants={sceneBlinkVariants}
      initial={false}
      animate={animated ? "blink" : "open"}
      style={{ originX: 0.5, originY: 0.5 }}
    >
      <circle cx={53} cy={77} r={mood === "alert" ? 2.6 : 2} fill={INK} />
      <circle cx={67} cy={77} r={mood === "alert" ? 2.6 : 2} fill={INK} />
    </motion.g>
    {/* Mouth */}
    <path
      d={MOUTHS[mood]}
      fill="none"
      stroke={INK}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </g>
);

export default PersonBust;
