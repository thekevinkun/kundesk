"use client";

// "Prioritas Sekarang" — the few things that need the owner, each one a link to where it is fixed
// Only real state appears (see helpers/dashboard-priorities.ts); with nothing to do it stays calm

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { queueRowVariants } from "@/lib/animations";
import { PRIORITY_VISIBLE_COUNT } from "@/helpers/dashboard-priorities";
import type { PriorityItem, PriorityResult } from "@/types/dashboard";

// Tokens only, so dark mode and the organization's accent color keep working
const TONE_STYLES: Record<PriorityItem["tone"], { box: string; dot: string }> =
  {
    danger: {
      box: "border-(--color-danger)/30 bg-(--color-danger-bg)/50",
      dot: "bg-(--color-danger) motion-safe:animate-pulse",
    },
    warning: {
      box: "border-(--color-warning)/30 bg-(--color-warning-bg)/50",
      dot: "bg-(--color-warning)",
    },
  };

const PriorityPanel = ({ items, allClear }: PriorityResult) => {
  const reduceMotion = useReducedMotion() ?? false;
  // Whether the items beyond the first three are open
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? items : items.slice(0, PRIORITY_VISIBLE_COUNT);
  const canToggle = items.length > PRIORITY_VISIBLE_COUNT;

  // Reduced motion: items still appear and disappear, just without sliding
  const itemMotion = reduceMotion
    ? {}
    : {
        layout: "position" as const,
        variants: queueRowVariants,
        initial: "hidden",
        animate: "visible",
        exit: "exit",
      };

  return (
    <section
      className="card-base block p-5"
      aria-labelledby="current-priority-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="current-priority-title"
          className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-(--color-text-400)"
        >
          Prioritas Sekarang
        </h2>
        {items.length > 0 && (
          <span className="badge-base badge-danger px-1.5 py-0.5 text-[10px] tabular-nums">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <>
          <p className="mt-1.5 text-[15px] font-bold text-(--color-text-900)">
            {allClear.title}
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-(--color-text-500)">
            {allClear.detail}
          </p>
        </>
      ) : (
        <>
          {/* Polite live region: a new item appearing is announced without interrupting */}
          <ul className="mt-3 space-y-2" aria-live="polite">
            <AnimatePresence initial={false}>
              {visible.map((item) => {
                const tone = TONE_STYLES[item.tone];
                return (
                  <motion.li key={item.id} {...itemMotion}>
                    <Link
                      href={item.href}
                      className={`group flex items-start gap-3 rounded-[12px] border px-3 py-2.5 transition-colors hover:border-(--color-brand) focus:outline-none focus:ring-2 focus:ring-(--color-brand) ${tone.box}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${tone.dot}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-bold text-(--color-text-900)">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-(--color-text-500)">
                          {item.detail}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-0.5 text-[12px] font-semibold text-(--color-brand) transition-transform group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          {canToggle && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              className="mt-2.5 text-[11px] font-semibold text-(--color-brand) hover:underline"
            >
              {expanded
                ? "Tampilkan lebih sedikit"
                : `Lihat ${items.length - PRIORITY_VISIBLE_COUNT} lainnya`}
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default PriorityPanel;
