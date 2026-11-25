"use client";

// KUN robot in his gold helmet: ring antenna, headphones, dark visor and the "k" chat bubble on his chest
// Colors are KUN's own and do not follow the org accent color

import { motion } from "framer-motion";
import IsoPlatform from "@/components/dashboard/live-scene/IsoPlatform";
import KunRobotDefs from "@/components/dashboard/live-scene/KunRobotDefs";
import KunRobotFace from "@/components/dashboard/live-scene/KunRobotFace";
import { getKunPalette } from "@/helpers/kun-robot-palette";
import { sceneBreathVariants, scenePulseVariants } from "@/lib/animations";
import type { KunRobotProps } from "@/types/live-scene";

const KunRobot = ({ pose, animated }: KunRobotProps) => {
  const off = pose === "off";
  const tired = pose === "tired";
  const active = pose === "active";
  // Gold or steel colors for this pose
  const p = getKunPalette(pose);
  // Breathing: steady when active, slower when tired, none when off or motion is reduced
  const breath = !animated || off ? "still" : tired ? "breatheSlow" : "breathe";

  return (
    <svg
      viewBox="0 0 140 176"
      className="block h-auto w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <KunRobotDefs />
      <IsoPlatform cx={70} top={126} strokeClass={p.tileClass} />
      {/* The robot breathes from his feet, the tile stays still */}
      <motion.g
        variants={sceneBreathVariants}
        initial={false}
        animate={breath}
        style={{ originX: 0.5, originY: 1, opacity: p.opacity }}
      >
        {/* Antenna: short stem and the open ring from the logo */}
        <rect
          x={67.5}
          y={16}
          width={5}
          height={9}
          fill={p.dark}
          stroke={p.edge}
          strokeWidth={1}
        />
        <circle
          cx={70}
          cy={10}
          r={7}
          fill="none"
          stroke={p.edge}
          strokeWidth={4.6}
        />
        <circle
          cx={70}
          cy={10}
          r={7}
          fill="none"
          stroke={p.body}
          strokeWidth={3}
        />
        {/* Light inside the ring: pulses when active, dim when tired, absent when off */}
        {active && (
          <motion.circle
            cx={70}
            cy={10}
            r={2}
            fill="#FFF3C4"
            variants={scenePulseVariants}
            initial={false}
            animate={animated ? "pulse" : "still"}
            style={{ originX: 0.5, originY: 0.5 }}
          />
        )}
        {tired && <circle cx={70} cy={10} r={2} fill="#E08A1E" />}
        {/* Sparkle strokes beside the antenna, only while active */}
        {active && (
          <path
            d="M86 13 L91 7 M92 19 L99 15"
            stroke={p.mark}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        )}
        {/* Headphone cups on both sides of the helmet */}
        {[15, 111].map((x) => (
          <g key={x}>
            <rect
              x={x}
              y={41}
              width={14}
              height={32}
              rx={7}
              fill={p.dark}
              stroke={p.edge}
              strokeWidth={1.2}
            />
            <rect
              x={x + 3.5}
              y={47}
              width={7}
              height={20}
              rx={3.5}
              fill={p.body}
              opacity={0.55}
            />
          </g>
        ))}
        {/* Neck */}
        <rect
          x={58}
          y={82}
          width={24}
          height={12}
          rx={4}
          fill={p.dark}
          stroke={p.edge}
          strokeWidth={1}
        />
        {/* Helmet, visor and a soft highlight on the glass */}
        <rect
          x={26}
          y={22}
          width={88}
          height={66}
          rx={30}
          fill={p.body}
          stroke={p.edge}
          strokeWidth={1.4}
        />
        <rect
          x={36}
          y={31}
          width={68}
          height={49}
          rx={21}
          fill={p.visor}
          stroke={p.edge}
          strokeWidth={1.6}
        />
        <path
          d="M46 40 Q56 34 68 35"
          stroke="#ffffff"
          strokeOpacity={0.18}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
        {/* Face on the visor */}
        <KunRobotFace pose={pose} animated={animated} />
        {/* Body, arms and mitten hands */}
        <rect
          x={38}
          y={90}
          width={64}
          height={48}
          rx={18}
          fill={p.body}
          stroke={p.edge}
          strokeWidth={1.4}
        />
        {[26, 102].map((x) => (
          <rect
            key={x}
            x={x}
            y={96}
            width={12}
            height={28}
            rx={6}
            fill={p.dark}
            stroke={p.edge}
            strokeWidth={1.1}
          />
        ))}
        {[32, 108].map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy={129}
            r={7.5}
            fill={p.body}
            stroke={p.edge}
            strokeWidth={1.2}
          />
        ))}
        {/* Chest: dark chat bubble with a "k" — drawn as shapes, not the logo image */}
        <path
          d="M57 100 H83 Q90 100 90 107 V117 Q90 124 83 124 H72 L66 131 L65 124 H57 Q50 124 50 117 V107 Q50 100 57 100 Z"
          fill="#171d29"
          stroke={p.edge}
          strokeWidth={1.2}
        />
        <g transform="translate(3, 0)">
          <path
            d="M62 106 V118 M62 113 L73 106 M65.5 112 L74 118"
            stroke={p.mark}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
        {/* Sweat drop when the quota is full */}
        {tired && (
          <path
            d="M117 24 q-6 9 0 13 q6 -4 0 -13z"
            className="fill-(--color-info)"
          />
        )}
      </motion.g>
    </svg>
  );
};

export default KunRobot;
