"use client";

// Admin character with headset and laptop: dim when idle, amber when alerted, typing when handling a chat

import { motion } from "framer-motion";
import IsoPlatform from "@/components/dashboard/live-scene/IsoPlatform";
import PersonBust from "@/components/dashboard/live-scene/PersonBust";
import {
  sceneScreenLineVariants,
  scenePulseVariants,
  sceneTypingVariants,
} from "@/lib/animations";
import type { AdminAvatarProps } from "@/types/live-scene";

// Width of each fake text line on the working screen — decoration, not content
const SCREEN_LINES = [20, 14, 24] as const;
// Headset color — fixed, reads on every skin tone
const HEADSET = "#2D3748";

const AdminAvatar = ({ pose, look, animated }: AdminAvatarProps) => {
  const alerted = pose === "alerted";
  const working = pose === "working";
  // Screen color tells the state at a glance
  const screenClass = working
    ? "fill-(--color-brand)"
    : alerted
      ? "fill-(--color-warning)"
      : "fill-[#3A4560]";
  const tileClass = alerted
    ? "stroke-(--color-warning)"
    : working
      ? "stroke-(--color-brand)"
      : "stroke-(--color-border)";
  // Typing motion only while working and motion is allowed
  const typing = working && animated ? "type" : "still";

  return (
    <svg
      viewBox="0 0 120 170"
      className="block h-auto w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <IsoPlatform cx={60} top={118} strokeClass={tileClass} />
      <PersonBust
        look={look}
        animated={animated}
        mood={alerted ? "alert" : "calm"}
      />
      {/* Headset: band, two ear cups, microphone arm */}
      <path
        d="M42 74 C42 54 78 54 78 74"
        fill="none"
        stroke={HEADSET}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <rect x={38} y={70} width={6} height={12} rx={3} fill={HEADSET} />
      <rect x={76} y={70} width={6} height={12} rx={3} fill={HEADSET} />
      <path
        d="M79 82 Q80 92 69 91"
        fill="none"
        stroke={HEADSET}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={67} cy={91} r={2.6} fill={HEADSET} />
      {/* Laptop: bezel, screen, base */}
      <rect x={40} y={110} width={40} height={24} rx={3} fill="#1B2236" />
      <rect
        x={43}
        y={113}
        width={34}
        height={18}
        rx={2}
        className={screenClass}
      />
      <rect
        x={34}
        y={134}
        width={52}
        height={4}
        rx={2}
        className="fill-(--color-text-500)"
      />
      {/* Working: text lines on the screen and two hands on the keys */}
      {working && (
        <>
          {SCREEN_LINES.map((width, index) => (
            <motion.rect
              key={width}
              x={46}
              y={117 + index * 4.5}
              width={width}
              height={2.4}
              rx={1.2}
              fill="#ffffff"
              variants={sceneScreenLineVariants}
              custom={index}
              initial={false}
              animate={typing}
            />
          ))}
          <motion.circle
            cx={50}
            cy={137}
            r={3.2}
            fill={look.skin}
            variants={sceneTypingVariants}
            custom={0}
            initial={false}
            animate={typing}
          />
          <motion.circle
            cx={70}
            cy={137}
            r={3.2}
            fill={look.skin}
            variants={sceneTypingVariants}
            custom={0.25}
            initial={false}
            animate={typing}
          />
        </>
      )}
      {/* Amber "!" badge while a handoff waits for this admin */}
      {alerted && (
        <motion.g
          variants={scenePulseVariants}
          initial={false}
          animate={animated ? "pulse" : "still"}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          <circle cx={92} cy={50} r={10} className="fill-(--color-warning)" />
          <text
            x={92}
            y={55}
            textAnchor="middle"
            className="fill-white"
            fontSize={14}
            fontWeight={800}
          >
            !
          </text>
        </motion.g>
      )}
    </svg>
  );
};

export default AdminAvatar;
