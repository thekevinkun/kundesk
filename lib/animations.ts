// Reusable Framer Motion animation variants — import these everywhere
// Never define animation variants inline in components
// Used across: auth pages, dashboard, homepage, chat widget

import type { Variants } from "framer-motion";

// ── Fade up — general purpose entrance animation ──
// Use on page sections, cards, any element entering from below
export const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1], // --ease-smooth from design system
    },
  },
};

// ── Fade in — simple opacity entrance, no movement ──
// Use on overlays, backgrounds, subtle reveals
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

// ── Scale up — entrance with subtle scale ──
// Use on cards, modals, floating elements
export const scaleUp: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// ── Stagger container — wraps children that animate in sequence
// Use on lists, grids, any group of items entering one by one
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// ── Stagger item — child of staggerContainer ──
// Always pair with staggerContainer on the parent
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// ── Slide in from left — sidebar, drawer entrances ──
export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -24,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// ── Slide in from right — notifications, panels ──
export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 24,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// Dropdown panel — floating menus, notification panel, color picker
export const dropdownVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    transition: { duration: 0.18 },
  },
};

// ── Scroll reveal — section entrance triggered by viewport ──
// Use on every landing page section with whileInView
export const scrollReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

// ── Float — hero floating cards endless loop ──
// Use with animate (not whileInView) — runs forever
export const floatVariant = (delay: number = 0): Variants => ({
  initial: { y: 0 },
  animate: {
    y: [-8, 0, -8],
    transition: {
      duration: 4,
      ease: "easeInOut",
      repeat: Infinity,
      delay,
    },
  },
});

// ── Stagger container for landing sections ──
// Slower stagger than dashboard — more cinematic
export const landingStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

// ── Landing stagger item — pairs with landingStagger ──
export const landingStaggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 28,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export const testiSlideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
    transition: { duration: 0.3 },
  }),
};

// ── Chat bubble entrance — used in RagPreview looping animation ──
// Bubbles slide in from their respective sides
export const chatBubbleIn: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

// ── Live scene — idle life for the avatars; every value is subtle on purpose ──
// Components switch these on only when motion is allowed (prefers-reduced-motion)
export const sceneBreathVariants: Variants = {
  still: { y: 0, scale: 1 },
  breathe: {
    y: [0, -2, 0],
    scale: [1, 1.012, 1],
    transition: { duration: 3.2, ease: "easeInOut", repeat: Infinity },
  },
  breatheSlow: {
    y: [0, -1, 0],
    scale: [1, 1.006, 1],
    transition: { duration: 5.5, ease: "easeInOut", repeat: Infinity },
  },
};

// Eyes close briefly every few seconds
export const sceneBlinkVariants: Variants = {
  open: { scaleY: 1 },
  blink: {
    scaleY: [1, 1, 0.1, 1, 1],
    transition: {
      duration: 4.2,
      times: [0, 0.46, 0.5, 0.54, 1],
      repeat: Infinity,
    },
  },
};

// Customer arm: hanging down, raised, or waving for attention
export const sceneArmVariants: Variants = {
  down: { rotate: 0 },
  raised: { rotate: -150 },
  wave: {
    rotate: [-150, -132, -150],
    transition: { duration: 0.9, ease: "easeInOut", repeat: Infinity },
  },
};

// "!" badges and the antenna lamp
export const scenePulseVariants: Variants = {
  still: { opacity: 1, scale: 1 },
  pulse: {
    opacity: [1, 0.5, 1],
    scale: [1, 1.12, 1],
    transition: { duration: 1.4, ease: "easeInOut", repeat: Infinity },
  },
};

// Admin hands on the keyboard — custom is the start delay so the two hands alternate
export const sceneTypingVariants: Variants = {
  still: { y: 0 },
  type: (delay: number) => ({
    y: [0, -2.5, 0],
    transition: { duration: 0.5, ease: "easeInOut", repeat: Infinity, delay },
  }),
};

// Text lines on the admin's screen — custom is the line index
export const sceneScreenLineVariants: Variants = {
  still: { opacity: 0.85 },
  type: (index: number) => ({
    opacity: [0.35, 0.95, 0.35],
    transition: {
      duration: 1.2,
      ease: "easeInOut",
      repeat: Infinity,
      delay: index * 0.25,
    },
  }),
};

// ── Live conversation workspace — one-shot, Pusher-driven motion only ──
export const liveWorkspacePacketVariants: Variants = {
  leftToCenter: {
    x: [0, 104],
    opacity: [0, 1, 1, 0],
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
  centerToLeft: {
    x: [0, -104],
    opacity: [0, 1, 1, 0],
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
  centerToRight: {
    x: [0, 104],
    opacity: [0, 1, 1, 0],
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
  rightToCenter: {
    x: [0, -104],
    opacity: [0, 1, 1, 0],
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
  leftToRight: {
    x: [0, 208],
    opacity: [0, 1, 1, 0],
    transition: { duration: 1.05, ease: [0.22, 1, 0.36, 1] },
  },
  rightToLeft: {
    x: [0, -208],
    opacity: [0, 1, 1, 0],
    transition: { duration: 1.05, ease: [0.22, 1, 0.36, 1] },
  },
};
