// Tiny customer face for a queue row — same look (skin, hair, shirt) the live scene gives this session
// Decorative only: the row's own label already says who the conversation belongs to

import type { AvatarLook } from "@/types/live-scene";

interface QueueAvatarProps {
  look: AvatarLook;
  // Pending handoff: a red ring so the row reads as urgent even without color-reading the stripe
  urgent?: boolean;
}

// Hair shapes in a 32x32 box — the fringe is shared, long hair adds a back panel, bun adds a knot
const FRINGE_PATH =
  "M10 13 C10 8 13 7 16 7 C19 7 22 8 22 13 C20 11 18 10.5 16 10.5 C14 10.5 12 11 10 13 Z";
const LONG_BACK_PATH =
  "M9.5 13 C9.5 7 12.5 6 16 6 C19.5 6 22.5 7 22.5 13 L22.5 22 L9.5 22 Z";

const QueueAvatar = ({ look, urgent = false }: QueueAvatarProps) => (
  <svg
    viewBox="0 0 32 32"
    className={`size-8 shrink-0 rounded-full bg-(--color-bg-page) ${
      urgent ? "ring-2 ring-(--color-danger)" : "ring-1 ring-(--color-border)"
    }`}
    aria-hidden="true"
    focusable="false"
  >
    {/* Hair behind the head — only long hair has a back panel */}
    {look.hairStyle === "long" && <path d={LONG_BACK_PATH} fill={look.hair} />}
    {/* Shoulders in the shirt color */}
    <path d="M4 32 C4 24 10 21 16 21 C22 21 28 24 28 32 Z" fill={look.shirt} />
    {/* Neck and head */}
    <rect x="14" y="18" width="4" height="4" fill={look.skin} />
    <circle cx="16" cy="14" r="6" fill={look.skin} />
    {/* Bun sits above the fringe */}
    {look.hairStyle === "bun" && (
      <circle cx="16" cy="6.5" r="3" fill={look.hair} />
    )}
    {/* Fringe — every style has it */}
    <path d={FRINGE_PATH} fill={look.hair} />
    {/* Eyes */}
    <circle cx="13.6" cy="14.6" r="0.8" fill="#2A1A10" />
    <circle cx="18.4" cy="14.6" r="0.8" fill="#2A1A10" />
  </svg>
);

export default QueueAvatar;
