"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getRecentKnowledgeItemsAction } from "@/lib/actions/dashboard";
import type { RecentKnowledgeItem } from "@/types/dashboard";

interface KnowledgeKunPanelProps {
  orgId: string;
  initialItems: RecentKnowledgeItem[];
  documentCount: number;
  totalChunks: number;
}

const documentType = (title: string) => {
  const extension = title.split(".").pop()?.toUpperCase();
  return extension && extension !== title.toUpperCase() ? extension : "FILE";
};

const manualLabel = (kind: string | null) => {
  const labels: Record<string, string> = {
    catalog: "Katalog",
    faq: "FAQ",
    policy: "Kebijakan",
    promo: "Promo",
    note: "Catatan",
  };
  return kind ? (labels[kind] ?? "Isi Manual") : "Isi Manual";
};

const KnowledgeKunPanel = ({
  orgId,
  initialItems,
  documentCount,
  totalChunks,
}: KnowledgeKunPanelProps) => {
  const { data: items } = useQuery({
    queryKey: ["dashboard", orgId, "recent-knowledge"],
    queryFn: getRecentKnowledgeItemsAction,
    initialData: initialItems,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  return (
    <section className="card-base overflow-hidden" aria-labelledby="knowledge-kun-title">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[12px] bg-(--color-brand-light) text-lg" aria-hidden="true">
            ▤
          </span>
          <div>
            <h2 id="knowledge-kun-title" className="text-[15px] font-bold text-(--color-text-900)">
              Knowledge KUN
            </h2>
            <p className="mt-0.5 text-[11px] text-(--color-text-500)">
              {documentCount} dokumen · {totalChunks.toLocaleString("id-ID")} chunks
            </p>
          </div>
        </div>
        <Link href="/dashboard/knowledge" className="pt-1 text-[11px] font-semibold text-(--color-brand) hover:underline">
          Kelola →
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="border-t border-(--color-border-sm)">
          {items.map((item) => {
            const isDocument = item.source === "document";
            const type = isDocument ? documentType(item.title) : manualLabel(item.kind);
            const detail = isDocument
              ? `${item.chunkCount} chunks · Dokumen siap`
              : `${item.entryCount ?? 0} item · ${item.chunkCount} chunks`;

            return (
              <Link
                key={`${item.source}-${item.id}`}
                href="/dashboard/knowledge"
                className="group flex gap-3 border-b border-(--color-border-sm) px-5 py-3 last:border-b-0 hover:bg-(--color-bg-page)"
              >
                <span className={`flex h-7 min-w-9 items-center justify-center rounded-[7px] px-1 text-[9px] font-extrabold ${isDocument ? "bg-(--color-danger-bg) text-(--color-danger)" : "bg-(--color-brand-light) text-(--color-brand)"}`}>
                  {type}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-semibold text-(--color-text-800) group-hover:text-(--color-brand)">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-(--color-text-500)">{detail}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="border-t border-(--color-border-sm) px-5 py-5 text-[11.5px] leading-relaxed text-(--color-text-500)">
          Belum ada dokumen atau Isi Manual yang tersimpan.
        </div>
      )}
    </section>
  );
};

export default KnowledgeKunPanel;
