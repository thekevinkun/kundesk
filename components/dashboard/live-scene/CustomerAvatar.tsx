"use client";

// Customer character: waves with a "!" badge while waiting for staff, ghosted when there is no live chat

import { motion } from "framer-motion";
import IsoPlatform from "@/components/dashboard/live-scene/IsoPlatform";
import PersonBust from "@/components/dashboard/live-scene/PersonBust";
import { sceneArmVariants, scenePulseVariants } from "@/lib/animations";
import type { CustomerAvatarProps } from "@/types/live-scene";

const CustomerAvatar = ({ pose, look, animated }: CustomerAvatarProps) => {
  const waiting = pose === "waiting";
  const absent = pose === "absent";
  // Arm state: hanging, waving (motion allowed) or held up (reduced motion)
  const armState = waiting ? (animated ? "wave" : "raised") : "down";

  return (
    <svg
      viewBox="0 0 120 170"
      className="block h-auto w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      {/* Tile outline turns red while the customer waits for staff */}
      <IsoPlatform
        cx={60}
        top={118}
        strokeClass={
          waiting ? "stroke-(--color-danger)" : "stroke-(--color-brand-mid)"
        }
      />
      {/* No live conversation: the same person, faded */}
      <g opacity={absent ? 0.35 : 1}>
        <PersonBust
          look={look}
          animated={animated && !absent}
          mood={waiting ? "worried" : "calm"}
        />
        {/* Arm pivots at the right shoulder */}
        <g transform="translate(82 110)">
          <motion.g
            variants={sceneArmVariants}
            initial={false}
            animate={armState}
            style={{ originX: 0.5, originY: 0 }}
          >
            <rect x={-4} y={0} width={8} height={16} rx={4} fill={look.shirt} />
            <circle cx={0} cy={19} r={5} fill={look.skin} />
          </motion.g>
        </g>
      </g>
      {/* "!" badge — only while a handoff is pending */}
      {waiting && (
        <motion.g
          variants={scenePulseVariants}
          initial={false}
          animate={animated ? "pulse" : "still"}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          <circle cx={28} cy={52} r={10} className="fill-(--color-danger)" />
          <text
            x={28}
            y={57}
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

export default CustomerAvatar;
