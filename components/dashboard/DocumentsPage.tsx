"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { Channel } from "pusher-js";
import { useDocumentStore } from "@/stores/document-store";
import { useDocumentUpload } from "@/hooks/use-document-upload";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { DocumentSelect } from "@/types/db";
import type { ApiResponse } from "@/types/api";
import type { DocumentUpdatedPayload } from "@/lib/pusher";
import { staggerContainer, staggerItem, fadeUp } from "@/lib/animations";

// ── File icon — colored background based on extension ──
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

// ── Document row — single document from the server list ──
const DocumentRow = ({
  doc,
  onDelete,
  isDeleting,
}: {
  doc: DocumentSelect;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) => {
  return (
    <motion.div
      variants={staggerItem}
      className="flex items-center gap-3 px-5 py-3.5 border-b border-(--color-border-sm) last:border-0 
        hover:bg-(--color-bg-page) transition-colors group cursor-default"
    >
      <FileIcon filename={doc.name} />

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-(--color-text-900) truncate mb-0.5">
          {doc.name}
        </div>
        <div className="text-[11.5px] text-(--color-text-400)">
          {doc.status === "ready"
            ? `${doc.chunkCount} chunks`
            : doc.status === "failed"
              ? "Gagal diproses"
              : "Memproses..."}
        </div>
      </div>

      <StatusBadge status={doc.status} />

      {/* Delete button — visible on hover, shows spinner when deleting */}
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

// ── Document row skeleton — shown while TanStack Query is loading ──
const DocumentRowSkeleton = () => {
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

// ── Uploading row — in-flight file tracked by Zustand ──
const UploadingRow = ({
  filename,
  progress,
  error,
}: {
  filename: string;
  progress: number;
  error: string | null;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3 px-5 py-3.5 border-b border-(--color-border-sm) bg-(--color-brand-light)/40"
    >
      <FileIcon filename={filename} />

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-(--color-text-900) truncate mb-1.5">
          {filename}
        </div>
        {error ? (
          // Error message replaces progress bar
          <div className="text-[11.5px] text-(--color-danger)">{error}</div>
        ) : (
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-[11px] text-(--color-text-400) w-8 text-right tabular-nums">
              {progress}%
            </span>
          </div>
        )}
      </div>

      <span className={`badge-base ${error ? "badge-danger" : "badge-brand"}`}>
        {error ? "Gagal" : "Upload"}
      </span>
    </motion.div>
  );
};

// ── Upload zone — drag/drop + click to select ──
const UploadZone = ({ onFiles }: { onFiles: (files: File[]) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles(files);
      // Reset so the same file can be re-selected after removal
      e.target.value = "";
    },
    [onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload dokumen — klik atau drag dan drop file PDF, TXT, MD, atau DOCX"
      className="mx-5 my-3 border-2 border-dashed border-(--color-border) rounded-[10px] p-5 
        text-center cursor-pointer transition-all hover:border-(--color-brand) hover:bg-(--color-brand-light)/30 group"
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <div className="text-2xl mb-2 transition-transform group-hover:scale-110">
        ☁️
      </div>
      <p className="text-[13px] text-(--color-text-500)">
        <span className="text-(--color-brand) font-semibold">
          Klik untuk upload
        </span>{" "}
        atau drag &amp; drop
      </p>
      <p className="text-[11px] text-(--color-text-400) mt-1">
        PDF, TXT, MD, DOCX — maks 10MB
      </p>

      {/* Hidden file input — multiple files allowed */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,text/x-markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};

// ── Main export ──
const DocumentsPage = () => {
  const queryClient = useQueryClient();
  const { uploadingFiles } = useDocumentStore();
  const { uploadFile } = useDocumentUpload();

  // Deletes a document — optimistically removes from cache, refetches on error
  // Track which document ID is currently being deleted
  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus dokumen");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Dokumen dihapus");
    },
    onError: () => {
      toast.error("Gagal menghapus dokumen", {
        description: "Coba lagi beberapa saat.",
      });
    },
  });

  // ── TanStack Query — fetch documents list ──
  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents");
      const json = (await res.json()) as ApiResponse<DocumentSelect[]>;
      if (!json.ok) throw new Error("Gagal memuat dokumen");
      return json.data;
    },
  });

  // ── Pusher — live document status updates ──
  useEffect(() => {
    // Channel ref — typed correctly with pusher-js Channel type
    let channel: Channel | null = null;
    let pusher: import("pusher-js").default | null = null;

    const setup = async () => {
      // Get orgId from Clerk's active session
      const { Clerk } = window as unknown as {
        Clerk?: { organization?: { id: string } };
      };
      const orgId = Clerk?.organization?.id;
      if (!orgId) return;

      // Dynamic import — pusher-js only loaded on client when needed
      const PusherClient = (await import("pusher-js")).default;

      pusher = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_KEY ?? "mock-key",
        { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap1" },
      );

      // Subscribe to this org's channel — format: org-{orgId}
      channel = pusher.subscribe(`org-${orgId}`);

      // Patch the specific document in TanStack Query cache when status changes
      // Avoids a full refetch — surgical update of just the changed document
      channel.bind("document:updated", (_payload: DocumentUpdatedPayload) => {
        // Intentionally empty — invalidation handled by upload hook after process completes
        // Pusher is used for future real-time updates from other sessions
      });
    };

    void setup();

    // Cleanup — unsubscribe on unmount to prevent memory leaks
    return () => {
      channel?.unbind_all();
      channel?.unsubscribe();
      pusher?.disconnect();
    };
  }, [queryClient]);

  // Handle files dropped or selected — trigger upload for each
  const handleFiles = useCallback(
    (files: File[]) => {
      files.forEach((file) => void uploadFile(file));
    },
    [uploadFile],
  );

  const uploadingList = Array.from(uploadingFiles.values());
  const documentList = data ?? [];

  // Filter out server documents that are still showing as uploading rows
  // Prevents duplicate rows during the brief overlap period
  const uploadingFilenames = new Set(uploadingList.map((f) => f.filename));
  const visibleDocuments = documentList.filter(
    (doc) => !uploadingFilenames.has(doc.name),
  );

  const totalChunks = visibleDocuments.reduce(
    (sum, d) => sum + d.chunkCount,
    0,
  );
  const isEmpty =
    !isLoading && visibleDocuments.length === 0 && uploadingList.length === 0;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="max-w-3xl mx-auto"
    >
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
          Dokumen
        </h1>
        <p className="text-[13px] text-(--color-text-500) mt-1">
          Upload menu, FAQ, atau daftar harga — AI kamu akan mempelajarinya
          otomatis.
        </p>
      </div>

      {/* Main card */}
      <div className="card-base overflow-hidden">
        {/* Card header — doc count + chunk total */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-(--color-border-sm)">
          <div>
            <div className="text-[15px] font-bold text-(--color-text-900)">
              Knowledge Base
            </div>
            <div className="text-[11.5px] text-(--color-text-400) mt-0.5">
              {isLoading
                ? "Memuat..."
                : `${visibleDocuments.length} dokumen · ${totalChunks} chunks`}
            </div>
          </div>
        </div>

        {/* Document list — aria-live so screen readers announce status changes */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          aria-live="polite"
          aria-label="Daftar dokumen"
        >
          {/* Skeleton rows while loading */}
          {isLoading && (
            <>
              <DocumentRowSkeleton />
              <DocumentRowSkeleton />
              <DocumentRowSkeleton />
            </>
          )}

          {/* In-flight uploads from Zustand — above server docs */}
          <AnimatePresence>
            {uploadingList.map((f) => (
              <UploadingRow
                key={f.id}
                filename={f.filename}
                progress={f.progress}
                error={f.error}
              />
            ))}
          </AnimatePresence>

          {/* Server documents from TanStack Query */}
          {!isLoading &&
            visibleDocuments.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={(id) => deleteMutation.mutate(id)}
                isDeleting={
                  deleteMutation.isPending &&
                  deleteMutation.variables === doc.id
                }
              />
            ))}

          {/* Empty state */}
          {isEmpty && (
            <div className="py-14 text-center">
              <div className="text-4xl mb-3">📂</div>
              <div className="text-[14px] font-semibold text-(--color-text-500)">
                Belum ada dokumen
              </div>
              <div className="text-[12px] text-(--color-text-400) mt-1">
                Upload dokumen pertama kamu di bawah
              </div>
            </div>
          )}
        </motion.div>

        {/* Upload zone — always visible at the bottom of the card */}
        <UploadZone onFiles={handleFiles} />
      </div>
    </motion.div>
  );
};

export default DocumentsPage;
