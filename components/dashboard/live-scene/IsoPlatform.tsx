// Isometric floor tile every character stands on — pure SVG, colors come from theme tokens

import type { IsoPlatformProps } from "@/types/live-scene";

// Half-width, half-height and thickness of the diamond, in viewBox units
const HALF_W = 48;
const HALF_H = 18;
const DEPTH = 8;

const IsoPlatform = ({ cx, top, strokeClass }: IsoPlatformProps) => {
  // Four corners of the top face
  const topPoint = `${cx},${top}`;
  const right = `${cx + HALF_W},${top + HALF_H}`;
  const bottom = `${cx},${top + HALF_H * 2}`;
  const left = `${cx - HALF_W},${top + HALF_H}`;
  // The same corners pushed down to draw the two side faces
  const rightLow = `${cx + HALF_W},${top + HALF_H + DEPTH}`;
  const bottomLow = `${cx},${top + HALF_H * 2 + DEPTH}`;
  const leftLow = `${cx - HALF_W},${top + HALF_H + DEPTH}`;

  return (
    <g>
      {/* Soft ground shadow */}
      <ellipse
        cx={cx}
        cy={top + HALF_H * 2 + DEPTH}
        rx={HALF_W * 0.8}
        ry={5}
        className="fill-(--color-text-900)"
        opacity={0.1}
      />
      {/* Left side face */}
      <polygon
        points={`${left} ${bottom} ${bottomLow} ${leftLow}`}
        className="fill-(--color-bg-page)"
      />
      {/* Right side face */}
      <polygon
        points={`${bottom} ${right} ${rightLow} ${bottomLow}`}
        className="fill-(--color-border)"
      />
      {/* Top face — its outline carries the character's state color */}
      <polygon
        points={`${topPoint} ${right} ${bottom} ${left}`}
        className={`fill-(--color-bg-card) ${strokeClass}`}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </g>
  );
};

export default IsoPlatform;
