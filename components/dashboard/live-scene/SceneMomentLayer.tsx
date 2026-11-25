"use client";

// Everything that happens on stage for one real moment: a packet along the threads,
// a ring where it lands, a pop-up pill, and a screen-reader announcement

import { motion } from "framer-motion";
import {
  POPUP_POSITIONS,
  SCENE_ANCHORS,
  SCENE_MOMENTS,
  getPacketDurationSeconds,
  getPacketKeyframes,
} from "@/helpers/live-scene-moments";
import {
  sceneRingVariants,
  scenePacketTransition,
  scenePopupVariants,
} from "@/lib/animations";
import type { SceneMomentLayerProps, SceneTone } from "@/types/live-scene";

// Classes are written out in full so Tailwind can see them
const PILL: Record<SceneTone, string> = {
  signal: "bg-[#ef4444] text-white",
  brand: "bg-(--color-brand) text-white",
  warning: "bg-(--color-warning) text-white",
  danger: "bg-(--color-danger) text-white",
};
const DOT: Record<SceneTone, string> = {
  signal: "bg-[#ef4444] shadow-[0_0_0_5px_rgba(239,68,68,0.22)]",
  brand: "bg-(--color-brand) shadow-[0_0_0_5px_var(--color-brand-light)]",
  warning: "bg-(--color-warning) shadow-[0_0_0_5px_var(--color-warning-bg)]",
  danger: "bg-(--color-danger) shadow-[0_0_0_5px_var(--color-danger-bg)]",
};
const RING: Record<SceneTone, string> = {
  signal: "border-[#ef4444]",
  brand: "border-(--color-brand)",
  warning: "border-(--color-warning)",
  danger: "border-(--color-danger)",
};

const SceneMomentLayer = ({ moment, animated }: SceneMomentLayerProps) => {
  // No moment means an empty stage, but the live region stays mounted so changes are announced
  const spec = moment ? SCENE_MOMENTS[moment.kind] : null;
  const route = spec?.route ?? null;
  const popup = spec?.popup ?? null;
  const keyframes = route ? getPacketKeyframes(route) : null;
  const seconds = route ? getPacketDurationSeconds(route) : 0;
  const target = route ? SCENE_ANCHORS[route[route.length - 1] ?? "kun"] : null;

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {spec?.announce ?? ""}
      </p>
      {/* Packet and ring only when motion is allowed; the pop-up still shows */}
      {moment && spec && keyframes && target && animated && (
        <>
          <motion.span
            key={`packet-${moment.id}`}
            aria-hidden="true"
            className={`pointer-events-none absolute z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${DOT[spec.tone]}`}
            initial={{
              left: keyframes.left[0] ?? "0%",
              top: keyframes.top[0] ?? "0%",
              opacity: 0,
            }}
            animate={{
              left: keyframes.left,
              top: keyframes.top,
              opacity: [0, 1, 1, 0],
            }}
            transition={scenePacketTransition(seconds, keyframes.times)}
          />
          {/* Ring starts the moment the packet arrives */}
          <motion.span
            key={`ring-${moment.id}`}
            aria-hidden="true"
            className={`pointer-events-none absolute z-10 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${RING[spec.tone]}`}
            style={{ left: `${target.x}%`, top: `${target.y}%` }}
            variants={sceneRingVariants}
            initial="hidden"
            animate="ping"
            custom={seconds}
          />
        </>
      )}
      {moment && spec && popup && (
        <motion.span
          key={`popup-${moment.id}`}
          aria-hidden="true"
          className={`pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold shadow-md ${PILL[popup.tone]}`}
          style={{
            left: `${POPUP_POSITIONS[popup.anchor].left}%`,
            top: `${POPUP_POSITIONS[popup.anchor].top}%`,
          }}
          variants={scenePopupVariants}
          initial="hidden"
          animate="show"
          custom={{ animated, seconds: spec.durationMs / 1000 }}
        >
          {popup.text}
        </motion.span>
      )}
    </>
  );
};

export default SceneMomentLayer;
