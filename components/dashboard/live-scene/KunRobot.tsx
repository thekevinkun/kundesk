"use client";

// KUN robot with the logo on its chest: breathes and blinks when active, droops at a full quota, goes grey when off

import { motion } from "framer-motion";
import IsoPlatform from "@/components/dashboard/live-scene/IsoPlatform";
import {
  sceneBlinkVariants,
  sceneBreathVariants,
  scenePulseVariants,
} from "@/lib/animations";
import type { KunRobotProps } from "@/types/live-scene";

const KunRobot = ({ pose, animated }: KunRobotProps) => {
  const off = pose === "off";
  const tired = pose === "tired";
  // Theme-token classes per pose — the org accent color and dark mode follow automatically
  const body = off ? "fill-(--color-text-400)" : "fill-(--color-brand)";
  const dark = off ? "fill-(--color-text-500)" : "fill-(--color-brand-dark)";
  const darkLine = off
    ? "stroke-(--color-text-500)"
    : "stroke-(--color-brand-dark)";
  const face = off ? "fill-(--color-bg-page)" : "fill-(--color-brand-light)";
  const lamp = off
    ? "fill-(--color-text-400)"
    : tired
      ? "fill-(--color-warning)"
      : "fill-(--color-success)";
  // Breathing: steady when active, slower when tired, none when off or motion is reduced
  const breath = !animated || off ? "still" : tired ? "breatheSlow" : "breathe";
  const lively = animated && !off && !tired;

  return (
    <svg
      viewBox="0 0 140 176"
      className="block h-auto w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <IsoPlatform
        cx={70}
        top={126}
        strokeClass={off ? "stroke-(--color-border)" : "stroke-(--color-brand)"}
      />
      {/* The robot breathes from its feet, the tile stays still */}
      <motion.g
        variants={sceneBreathVariants}
        initial={false}
        animate={breath}
        style={{ originX: 0.5, originY: 1 }}
      >
        {/* Antenna and status lamp */}
        <line
          x1={70}
          y1={22}
          x2={70}
          y2={13}
          className={darkLine}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <motion.circle
          cx={70}
          cy={8}
          r={5}
          className={lamp}
          variants={scenePulseVariants}
          initial={false}
          animate={lively ? "pulse" : "still"}
          style={{ originX: 0.5, originY: 0.5 }}
        />
        {/* Ears, neck, head and face plate */}
        <rect x={24} y={42} width={9} height={26} rx={4.5} className={dark} />
        <rect x={107} y={42} width={9} height={26} rx={4.5} className={dark} />
        <rect x={60} y={82} width={20} height={10} rx={3} className={dark} />
        <rect x={30} y={22} width={80} height={64} rx={24} className={body} />
        <rect x={39} y={31} width={62} height={46} rx={17} className={face} />
        {/* Eyes and mouth by pose */}
        {off ? (
          <>
            <line
              x1={51}
              y1={54}
              x2={63}
              y2={54}
              className={darkLine}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <line
              x1={77}
              y1={54}
              x2={89}
              y2={54}
              className={darkLine}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </>
        ) : tired ? (
          <>
            <rect x={51} y={52} width={12} height={4} rx={2} className={dark} />
            <rect x={77} y={52} width={12} height={4} rx={2} className={dark} />
            <path
              d="M63 68 L77 68"
              className={darkLine}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <motion.g
              variants={sceneBlinkVariants}
              initial={false}
              animate={animated ? "blink" : "open"}
              style={{ originX: 0.5, originY: 0.5 }}
            >
              <circle cx={57} cy={54} r={6} className={dark} />
              <circle cx={83} cy={54} r={6} className={dark} />
              <circle cx={59} cy={52} r={1.8} fill="#ffffff" />
              <circle cx={85} cy={52} r={1.8} fill="#ffffff" />
            </motion.g>
            <path
              d="M62 66 Q70 71 78 66"
              className={darkLine}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </>
        )}
        {/* Body and arms */}
        <rect x={40} y={90} width={60} height={48} rx={16} className={body} />
        <rect x={28} y={96} width={10} height={28} rx={5} className={dark} />
        <rect x={102} y={96} width={10} height={28} rx={5} className={dark} />
        {/* Chest badge with the KUN logo */}
        <rect
          x={50}
          y={95}
          width={40}
          height={32}
          rx={11}
          className="fill-(--color-bg-card)"
        />
        <image
          href="/images/kun_logo.png"
          x={55}
          y={98}
          width={30}
          height={26}
          preserveAspectRatio="xMidYMid meet"
          opacity={off ? 0.5 : 1}
        />
        {/* Sweat drop when the quota is full */}
        {tired && (
          <path
            d="M113 24 q-6 9 0 13 q6 -4 0 -13z"
            className="fill-(--color-info)"
          />
        )}
      </motion.g>
    </svg>
  );
};

export default KunRobot;
