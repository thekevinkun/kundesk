"use client";

import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useDocumentStore } from "@/stores/document-store";
import { useDocumentUpload } from "@/hooks/use-document-upload";
import { toast } from "sonner";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type { Channel } from "pusher-js";
import type { DocumentSelect } from "@/types/db";
import type { ApiResponse } from "@/types/api";
import type { DocumentUpdatedPayload } from "@/lib/pusher";

import {
  TipPanel,
  DocumentRow,
  DocumentRowSkeleton,
  UploadingRow,
  UploadZone,
} from "./documents";

const DocumentsPage = () => {
  const queryClient = useQueryClient();
  const { uploadingFiles } = useDocumentStore();
  const { uploadFile } = useDocumentUpload();

  // ── Delete mutation ──
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

  // ── Fetch documents ──
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
    let channel: Channel | null = null;
    let pusher: import("pusher-js").default | null = null;

    const setup = async () => {
      const { Clerk } = window as unknown as {
        Clerk?: { organization?: { id: string } };
      };
      const orgId = Clerk?.organization?.id;
      if (!orgId) return;

      const PusherClient = (await import("pusher-js")).default;
      pusher = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_KEY ?? "mock-key",
        { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap1" },
      );

      channel = pusher.subscribe(`org-${orgId}`);

      // Patch document in cache when status changes — avoids full refetch
      channel.bind("document:updated", (_payload: DocumentUpdatedPayload) => {
        // Intentionally empty — invalidation handled by upload hook after processing
        // Pusher is wired for future real-time updates from other sessions
      });
    };

    void setup();

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

  // Filter server documents still showing as uploading — prevents duplicate rows
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
      className="flex flex-col items-center"
    >
      <div className="w-full max-w-4xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
            Dokumen
          </h1>
          <p className="text-[13px] text-(--color-text-500) mt-1">
            Upload menu, FAQ, atau daftar harga — KUN akan mempelajarinya
            otomatis.
          </p>
        </div>

        {/* Main card */}
        <div className="card-base overflow-hidden">
          {/* Card header */}
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

          {/* Tip panel */}
          <TipPanel />

          {/* Document list */}
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

            {/* In-flight uploads — above server docs */}
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

            {/* Server documents */}
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

          {/* Upload zone */}
          <UploadZone onFiles={handleFiles} />
        </div>
      </div>
    </motion.div>
  );
};

export default DocumentsPage;
