// Pure rules for one row of the "Knowledge KUN" rail: label, status, detail line, and where a click goes
// Kept out of the component so every format and status is tested

import type { RecentKnowledgeItem } from "@/types/dashboard";

export type KnowledgeRowStatus = "ready" | "processing" | "failed";

export interface KnowledgeRowDisplay {
  isDocument: boolean;
  // Short chip text: file type for documents, section kind for manual sections
  typeLabel: string;
  status: KnowledgeRowStatus;
  // Second line without the time — the component appends the relative time
  detail: string;
  // Only a ready document can be previewed in place; everything else opens Info Bisnis
  canPreview: boolean;
}

// File type from the name — four letters at most so the chip never overflows
function documentType(title: string): string {
  const extension = title.split(".").pop()?.toUpperCase();
  // No dot, or nothing after it, means there is no real extension
  if (!extension || extension === title.toUpperCase()) return "FILE";
  return extension.slice(0, 4);
}

const MANUAL_LABELS: Record<string, string> = {
  catalog: "Katalog",
  faq: "FAQ",
  policy: "Kebijakan",
  promo: "Promo",
  note: "Catatan",
};

// Unknown or missing kinds fall back to the generic name
function manualLabel(kind: string | null): string {
  return kind ? (MANUAL_LABELS[kind] ?? "Isi Manual") : "Isi Manual";
}

// Documents report their processing state; manual sections are always ready
function documentStatus(status: string | null): KnowledgeRowStatus {
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  // "processing" or anything unexpected: KUN has not finished learning it
  return "processing";
}

export function getKnowledgeRowDisplay(
  item: RecentKnowledgeItem,
): KnowledgeRowDisplay {
  if (item.source === "manual") {
    return {
      isDocument: false,
      typeLabel: manualLabel(item.kind),
      status: "ready",
      detail: `${item.entryCount ?? 0} item · ${item.chunkCount} chunks`,
      canPreview: false,
    };
  }

  const status = documentStatus(item.status);
  const detail =
    status === "ready"
      ? `${item.chunkCount} chunks · Dokumen siap`
      : status === "failed"
        ? "Gagal diproses — buka Info Bisnis"
        : "KUN sedang mempelajari dokumen";

  return {
    isDocument: true,
    typeLabel: documentType(item.title),
    status,
    detail,
    canPreview: status === "ready",
  };
}
