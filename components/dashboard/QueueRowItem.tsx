"use client";

// One row of the dashboard conversation queue
// Motion is layered on top of real changes only: slide in/out, reorder, and a soft flash
// when the row's status or latest message changes. Nothing plays on first load.

import { AnimatePresence, motion } from "framer-motion";
import { QueueAvatar } from "@/components/dashboard";
import { queueRowFlashVariants, queueRowVariants } from "@/lib/animations";
import { getAvatarLook } from "@/helpers/avatar-look";
import { formatRelativeTime } from "@/helpers/format";
import type { ConversationRow } from "@/types/api";
import type { RowAttention } from "@/types/dashboard";

// ── Status pill ──
const StatusPill = ({ status }: { status: string }) => {
  if (status === "human") {
    return (
      <span className="badge-base badge-warning text-[10px] px-1.5 py-0.5">
        Manual
      </span>
    );
  }
  if (status === "pending_handoff") {
    return (
      <span className="badge-base badge-danger text-[10px] px-1.5 py-0.5">
        Pending
      </span>
    );
  }
  return (
    <span className="badge-base badge-success text-[10px] px-1.5 py-0.5">
      KUN
    </span>
  );
};

interface QueueRowItemProps {
  convo: ConversationRow;
  // Ticking clock from the panel, so every relative time updates together
  now: number;
  onOpen: (conversationId: number) => void;
  // Rows beyond the phone cap are hidden below the xl breakpoint by CSS only
  hiddenOnMobile: boolean;
  reduceMotion: boolean;
  // New for staff, opened but unanswered, or nothing — computed by the panel
  attention: RowAttention;
}

const QueueRowItem = ({
  convo,
  now,
  onOpen,
  hiddenOnMobile,
  reduceMotion,
  attention,
}: QueueRowItemProps) => {
  const isPending = convo.handoffStatus === "pending_handoff";
  // Changes whenever something visible about the row changes — drives the flash
  const signature = `${convo.handoffStatus}:${String(convo.lastMessageAt ?? "")}:${convo.messageCount}`;
  // Reduced motion: no slide, no reorder animation, no flash
  const rowMotion = reduceMotion
    ? {}
    : {
        layout: "position" as const,
        variants: queueRowVariants,
        initial: "hidden",
        animate: "visible",
        exit: "exit",
      };

  return (
    <motion.li
      {...rowMotion}
      className={`border-b border-(--color-border-sm) last:border-0 ${
        hiddenOnMobile ? "max-xl:hidden" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(convo.id)}
        className={`group relative flex w-full gap-3 overflow-hidden px-4 py-3.5 text-left transition-colors hover:bg-(--color-bg-page) ${
          isPending ? "bg-(--color-danger-bg)/40" : ""
        }`}
        aria-label={`Buka percakapan ${convo.sessionId.slice(0, 8)}`}
      >
        {/* Urgent stripe — pending handoffs only */}
        {isPending && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] bg-(--color-danger)"
          />
        )}
        {/* Flash overlay — initial={false} means rows present at load never flash */}
        {!reduceMotion && (
          <AnimatePresence initial={false}>
            <motion.span
              key={signature}
              aria-hidden="true"
              variants={queueRowFlashVariants}
              initial="hidden"
              animate="flash"
              exit="gone"
              className={`pointer-events-none absolute inset-0 ${
                isPending
                  ? "bg-(--color-danger-bg)"
                  : "bg-(--color-brand-light)"
              }`}
            />
          </AnimatePresence>
        )}

        <QueueAvatar look={getAvatarLook(convo.sessionId)} urgent={isPending} />

        <div className="relative min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex-shrink-0 rounded-[4px] border border-(--color-border) bg-(--color-bg-page) px-1.5 py-0.5 font-mono text-[10.5px] text-(--color-text-400)">
                #{convo.sessionId.slice(0, 8)}
              </span>
              {/* Pulsing dot only on pending rows, and only when motion is allowed */}
              {isPending && (
                <span
                  aria-hidden="true"
                  className="size-1.5 flex-shrink-0 rounded-full bg-(--color-danger) motion-safe:animate-pulse"
                />
              )}
              <span
                className="truncate text-[10.5px] text-(--color-text-400)"
                suppressHydrationWarning
              >
                {formatRelativeTime(
                  convo.lastMessageAt ?? convo.createdAt,
                  now,
                )}
              </span>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              {/* Same signal as the sidebar count and the topbar dot */}
              {attention === "unread" && (
                <span className="rounded-full border border-(--color-brand) bg-(--color-brand)/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-(--color-brand)">
                  Baru
                </span>
              )}
              <StatusPill status={convo.handoffStatus} />
            </div>
          </div>

          <div className="line-clamp-2 text-[12px] leading-snug text-(--color-text-700) transition-colors group-hover:text-(--color-text-900)">
            {convo.lastMessage ? (
              `"${convo.lastMessage}"`
            ) : (
              <span className="italic text-(--color-text-400)">
                Belum ada pesan
              </span>
            )}
          </div>

          <div className="mt-1.5 text-[10.5px] text-(--color-text-400)">
            {convo.messageCount} pesan aktif
            {/* Opened by staff, customer still waiting — quiet text, no badge */}
            {attention === "awaiting" && (
              <span className="ml-1.5 font-semibold text-(--color-warning)">
                · Belum dibalas
              </span>
            )}
          </div>
        </div>
      </button>
    </motion.li>
  );
};

export default QueueRowItem;
