"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { KnowledgeRailRow } from "@/components/dashboard";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { getRecentKnowledgeItemsAction } from "@/lib/actions/dashboard";
import type {
  DocumentPreviewTarget,
  RecentKnowledgeItem,
} from "@/types/dashboard";

// Loaded only when a document is opened — most visits never need it
const DocumentPreviewDialog = dynamic(
  () => import("@/components/dashboard/documents/DocumentPreviewDialog"),
);

interface KnowledgeKunPanelProps {
  orgId: string;
  initialItems: RecentKnowledgeItem[];
  documentCount: number;
  totalChunks: number;
}

const KnowledgeKunPanel = ({
  orgId,
  initialItems,
  documentCount,
  totalChunks,
}: KnowledgeKunPanelProps) => {
  const reduceMotion = useReducedMotion() ?? false;
  const now = useMinuteNow();
  // The document currently open in the preview dialog, if any
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewTarget | null>(
    null,
  );

  // PusherProvider invalidates this key on document:updated, so a document that
  // finishes processing flips from "Memproses" without a reload
  const { data: items } = useQuery({
    queryKey: ["dashboard", orgId, "recent-knowledge"],
    queryFn: getRecentKnowledgeItemsAction,
    initialData: initialItems,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  return (
    <>
      <section
        className="card-base overflow-hidden"
        aria-labelledby="knowledge-kun-title"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-4">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-[12px] bg-(--color-brand-light) text-lg"
              aria-hidden="true"
            >
              ▤
            </span>
            <div>
              <h2
                id="knowledge-kun-title"
                className="text-[15px] font-bold text-(--color-text-900)"
              >
                Knowledge KUN
              </h2>
              <p className="mt-0.5 text-[11px] text-(--color-text-500)">
                {documentCount} dokumen · {totalChunks.toLocaleString("id-ID")}{" "}
                chunks
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/knowledge"
            className="pt-1 text-[11px] font-semibold text-(--color-brand) hover:underline"
          >
            Kelola →
          </Link>
        </div>

        {items.length > 0 ? (
          <div className="border-t border-(--color-border-sm)">
            {items.map((item) => (
              <KnowledgeRailRow
                key={`${item.source}-${item.id}`}
                item={item}
                now={now}
                reduceMotion={reduceMotion}
                onPreview={(picked) =>
                  setPreviewDoc({ id: picked.id, name: picked.title })
                }
              />
            ))}
          </div>
        ) : (
          <div className="border-t border-(--color-border-sm) px-5 py-5 text-[11.5px] leading-relaxed text-(--color-text-500)">
            Belum ada dokumen atau Isi Manual yang tersimpan.
          </div>
        )}
      </section>

      {/* Mounted only while open — the dialog hands focus back to the row on close */}
      {previewDoc && (
        <DocumentPreviewDialog
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
};

export default KnowledgeKunPanel;
