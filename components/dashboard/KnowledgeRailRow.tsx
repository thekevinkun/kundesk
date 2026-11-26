"use client";

// One row of the "Knowledge KUN" rail
// A ready document opens the preview in place; everything else goes to Info Bisnis
// A soft flash plays when the row's status, chunk count or update time changes — never on first load

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { formatRelativeTime } from "@/helpers/format";
import { getKnowledgeRowDisplay } from "@/helpers/knowledge-rail";
import { queueRowFlashVariants } from "@/lib/animations";
import type { RecentKnowledgeItem } from "@/types/dashboard";

interface KnowledgeRailRowProps {
  item: RecentKnowledgeItem;
  // Ticking clock from the panel, so every relative time updates together
  now: number;
  reduceMotion: boolean;
  onPreview: (item: RecentKnowledgeItem) => void;
}

const ROW_CLASS =
  "group relative flex w-full gap-3 overflow-hidden border-b border-(--color-border-sm) px-5 py-3 text-left last:border-b-0 hover:bg-(--color-bg-page) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-brand)";

const KnowledgeRailRow = ({
  item,
  now,
  reduceMotion,
  onPreview,
}: KnowledgeRailRowProps) => {
  const display = getKnowledgeRowDisplay(item);
  // Changes whenever something visible about the row changes — drives the flash
  const signature = `${display.status}:${item.chunkCount}:${item.updatedAt}`;

  const content = (
    <>
      {!reduceMotion && (
        <AnimatePresence initial={false}>
          <motion.span
            key={signature}
            aria-hidden="true"
            variants={queueRowFlashVariants}
            initial="hidden"
            animate="flash"
            exit="gone"
            className="pointer-events-none absolute inset-0 bg-(--color-brand-light)"
          />
        </AnimatePresence>
      )}

      <span
        className={`relative flex h-7 min-w-9 items-center justify-center rounded-[7px] px-1 text-[9px] font-extrabold ${
          display.isDocument
            ? "bg-(--color-danger-bg) text-(--color-danger)"
            : "bg-(--color-brand-light) text-(--color-brand)"
        }`}
      >
        {display.typeLabel}
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold text-(--color-text-800) group-hover:text-(--color-brand)">
          {item.title}
        </span>
        <span className="mt-0.5 block text-[10.5px] text-(--color-text-500)">
          {display.detail} ·{" "}
          <span suppressHydrationWarning>
            {formatRelativeTime(item.updatedAt, now)}
          </span>
        </span>
      </span>

      {/* Only unfinished or broken documents get a chip — ready rows stay quiet */}
      {display.status === "processing" && (
        <span className="badge-base badge-warning relative h-fit px-1.5 py-0.5 text-[9.5px]">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-(--color-warning) motion-safe:animate-pulse"
          />
          Memproses
        </span>
      )}
      {display.status === "failed" && (
        <span className="badge-base badge-danger relative h-fit px-1.5 py-0.5 text-[9.5px]">
          Gagal
        </span>
      )}
    </>
  );

  if (display.canPreview) {
    return (
      <button
        type="button"
        onClick={() => onPreview(item)}
        aria-haspopup="dialog"
        className={ROW_CLASS}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href="/dashboard/knowledge" className={ROW_CLASS}>
      {content}
    </Link>
  );
};

export default KnowledgeRailRow;
