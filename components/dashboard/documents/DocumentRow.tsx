// Single document row — file icon, name, chunk count, status badge, delete button
// FileIcon and StatusBadge are inlined here — only used in this file

"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerItem } from "@/lib/animations";
import type { DocumentSelect } from "@/types/db";

// ── File icon — colored background based on file extension ──
const FileIcon = ({ filename }: { filename: string }) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx";

  return (
    <div
      className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0 ${
        isPdf
          ? "bg-(--color-danger-bg)"
          : isDocx
            ? "bg-(--color-warning-bg)"
            : "bg-(--color-info-bg)"
      }`}
    >
      {isPdf ? "📄" : isDocx ? "📘" : "📝"}
    </div>
  );
};

// ── Status badge — maps document status to design system badge class ──
const StatusBadge = ({ status }: { status: DocumentSelect["status"] }) => {
  if (status === "ready") {
    return (
      <span className="badge-base badge-success">
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-success)" />
        Ready
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="badge-base badge-warning animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-warning)" />
        Proses
      </span>
    );
  }
  return (
    <span className="badge-base badge-danger">
      <span className="w-1.5 h-1.5 rounded-full bg-(--color-danger)" />
      Gagal
    </span>
  );
};

// ── Document row skeleton — shown while TanStack Query is loading ──
export const DocumentRowSkeleton = () => {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-(--color-border-sm)">
      <Skeleton className="w-10 h-10 rounded-[10px] flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
};

// ── Document row ──
interface DocumentRowProps {
  doc: DocumentSelect;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

const DocumentRow = ({ doc, onDelete, isDeleting }: DocumentRowProps) => {
  // Warn when a ready document has suspiciously few chunks
  // ≤3 chunks from a file that should have more = poor document structure
  const showChunkWarning =
    doc.status === "ready" && doc.chunkCount <= 3 && doc.chunkCount > 0;

  return (
    <motion.div
      variants={staggerItem}
      className="flex items-center gap-3 px-5 py-3.5 border-b border-(--color-border-sm) last:border-0 hover:bg-(--color-bg-page) transition-colors group cursor-default"
    >
      <FileIcon filename={doc.name} />

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-(--color-text-900) truncate mb-0.5">
          {doc.name}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11.5px] text-(--color-text-400)">
            {doc.status === "ready"
              ? `${doc.chunkCount} chunks`
              : doc.status === "failed"
                ? "Gagal diproses"
                : "Memproses..."}
          </span>
          {/* Chunk warning — shown when doc is ready but has very few chunks */}
          {showChunkWarning && (
            <span
              className="badge-base badge-warning text-[10.5px] cursor-help"
              title="Dokumen ini mungkin kurang optimal untuk AI. Coba pisahkan informasi ke beberapa bagian yang jelas, lalu upload ulang."
            >
              ⚠️ Kurang optimal
            </span>
          )}
        </div>
      </div>

      <StatusBadge status={doc.status} />

      {/* Delete button — only visible on row hover */}
      <button
        onClick={() => onDelete(doc.id)}
        disabled={isDeleting}
        aria-label={`Hapus dokumen ${doc.name}`}
        className="ml-1 w-7 h-7 rounded-[6px] flex items-center justify-center text-[13px]
          opacity-0 group-hover:opacity-100 transition-all hover:bg-(--color-danger-bg)
          hover:text-(--color-danger) disabled:opacity-40"
      >
        {isDeleting ? "⏳" : "🗑️"}
      </button>
    </motion.div>
  );
};

export default DocumentRow;
