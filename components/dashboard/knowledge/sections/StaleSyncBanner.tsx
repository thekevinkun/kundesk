"use client";

// Shown above the section list whenever any entry is out of sync (OpenAI
// was down during a save, or a retry is still pending). One click drives
// retryStaleKnowledgeSync to completion — it only processes up to
// MAX_RETRY_SECTIONS_PER_CALL (3) sections per call, so the UI loops
// automatically rather than making the owner click repeatedly.
//
// The loop tracks its own excludeSectionIds across iterations so a
// section that keeps failing to embed doesn't get retried forever while
// blocking every other stale section from a turn (CodeRabbit finding —
// see lib/actions/knowledge.ts's retryStaleKnowledgeSync for the
// server-side half of this fix).

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryStaleKnowledgeSync } from "@/lib/actions/knowledge";

interface StaleSyncBannerProps {
  staleEntryCount: number;
  onSynced: () => void;
}

// Safety cap on loop iterations — an unforeseen-bug backstop, not an
// expected path. At 3 sections/call this covers 45 sections in one click,
// comfortably above MAX_KNOWLEDGE_SECTIONS (30).
const MAX_RETRY_ITERATIONS = 15;

const StaleSyncBanner = ({
  staleEntryCount,
  onSynced,
}: StaleSyncBannerProps) => {
  const [isPending, startTransition] = useTransition();

  if (staleEntryCount === 0) return null;

  const handleRetry = () => {
    startTransition(async () => {
      let totalSynced = 0;
      let excludeSectionIds: number[] = [];
      let lastRemaining = 0;
      let stuck = false;

      for (let i = 0; i < MAX_RETRY_ITERATIONS; i++) {
        // A rejected call (e.g. requireOrgAdmin() throwing because the
        // session expired or admin access was revoked mid-retry) must not
        // silently kill the loop and drop any progress already made —
        // CodeRabbit finding
        const result = await retryStaleKnowledgeSync({
          excludeSectionIds,
        }).catch(() => null);

        if (!result) {
          stuck = true;
          break;
        }

        if (!result.success) {
          toast.error("Gagal menyinkronkan", { description: result.error });
          stuck = true;
          break;
        }

        totalSynced += result.data.synced;
        lastRemaining = result.data.remaining;
        excludeSectionIds = [
          ...excludeSectionIds,
          ...result.data.failedSectionIds,
        ];

        if (result.data.remaining === 0) break;

        // Nothing left to try this round and it's still not fully synced —
        // every remaining stale section has already failed once and is now
        // excluded. Looping further would do nothing.
        if (result.data.attemptedCount === 0) {
          stuck = true;
          break;
        }
      }

      // Covers both the "ran out of iterations" case and belt-and-suspenders
      // for any path above that left work undone — CodeRabbit finding
      if (lastRemaining > 0) stuck = true;

      if (totalSynced > 0) {
        toast.success(
          totalSynced === 1
            ? "1 bagian berhasil disinkronkan"
            : `${totalSynced} bagian berhasil disinkronkan`,
        );
      }

      if (stuck) {
        toast.error("Sebagian belum bisa disinkronkan", {
          description: "Coba lagi beberapa saat lagi.",
        });
      }

      onSynced();
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-(--radius-sm) bg-(--color-warning-bg) border border-(--color-warning)/30 text-[12.5px] text-(--color-warning)">
      <span>
        {staleEntryCount === 1
          ? "1 entri belum tersinkron dengan KUN."
          : `${staleEntryCount} entri belum tersinkron dengan KUN.`}
      </span>
      <Button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        aria-busy={isPending}
        className="bg-(--color-warning) text-white hover:opacity-90 text-[12px] px-3 py-1.5 h-auto flex-shrink-0"
      >
        {isPending ? "Menyinkronkan..." : "Coba lagi"}
      </Button>
    </div>
  );
};

export default StaleSyncBanner;
