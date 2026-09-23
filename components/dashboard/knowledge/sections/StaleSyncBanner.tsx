"use client";

// Shown above the section list whenever any entry is out of sync (OpenAI
// was down during a save, or a retry is still pending). One click drives
// retryStaleKnowledgeSync to completion — it only processes up to
// MAX_RETRY_SECTIONS_PER_CALL (3) sections per call, so the UI loops
// automatically rather than making the owner click repeatedly.

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryStaleKnowledgeSync } from "@/lib/actions/knowledge";

interface StaleSyncBannerProps {
  staleEntryCount: number;
  onSynced: () => void;
}

// Safety cap on loop iterations — MAX_KNOWLEDGE_SECTIONS (30) / 3 per call
// means 10 iterations covers every section even if all of them are stale.
// This is a backstop against an unforeseen bug, not an expected path.
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
      let stuck = false;

      for (let i = 0; i < MAX_RETRY_ITERATIONS; i++) {
        const result = await retryStaleKnowledgeSync();

        if (!result.success) {
          toast.error("Gagal menyinkronkan", { description: result.error });
          stuck = true;
          break;
        }

        totalSynced += result.data.synced;

        // No section made progress this round but some are still stale —
        // sync is genuinely failing (e.g. OpenAI down), not just queued.
        // Looping further would hammer the same failure forever.
        if (result.data.synced === 0 && result.data.remaining > 0) {
          stuck = true;
          break;
        }

        if (result.data.remaining === 0) break;
      }

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
