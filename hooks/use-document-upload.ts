// Encapsulates the full upload flow — presign → PUT → process
// Zustand owns in-flight upload state entirely
// TanStack Query only refetches when Pusher confirms completion

"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDocumentStore } from "@/stores/document-store";
import { toast } from "sonner";

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function useDocumentUpload() {
  const queryClient = useQueryClient();
  const {
    addUploadingFile,
    setUploadProgress,
    setUploadError,
    removeUploadingFile,
  } = useDocumentStore();

  const uploadFile = useCallback(
    async (file: File) => {
      const normalizedName = file.name.toLowerCase();
      const isAllowedType = ALLOWED_TYPES.includes(file.type);
      const isAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
        normalizedName.endsWith(ext),
      );

      if (!isAllowedType && !isAllowedExtension) {
        alert("Hanya file PDF, TXT, MD, dan DOCX yang diizinkan.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        alert("Ukuran file maksimal 10MB.");
        return;
      }

      const uploadId = crypto.randomUUID();
      addUploadingFile(uploadId, file.name);

      try {
        // ── Step 1: Get presigned URL ──
        const uploadRes = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
          }),
        });

        const uploadJson = (await uploadRes.json()) as {
          ok: boolean;
          data?: { uploadUrl: string; s3Key: string; documentId: number };
          error?: string;
        };

        if (!uploadJson.ok || !uploadJson.data) {
          throw new Error(uploadJson.error ?? "Upload gagal");
        }

        const { uploadUrl, s3Key, documentId } = uploadJson.data;

        // ── Step 2: PUT file to presigned URL ──
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(uploadId, pct);
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status === 200) resolve();
            else reject(new Error(`Upload gagal: ${xhr.status}`));
          });

          xhr.addEventListener("error", () =>
            reject(new Error("Network error saat upload")),
          );

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });

        // ── Step 3: Trigger processing ──
        setUploadProgress(uploadId, 100);

        const processRes = await fetch("/api/documents/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, s3Key }),
        });

        const processJson = (await processRes.json()) as {
          ok: boolean;
          error?: string;
        };

        // Processing failed — show error in uploading row, then refetch
        // so the failed document appears in the list from server
        if (!processRes.ok || !processJson.ok) {
          throw new Error(processJson.error ?? "Pemrosesan gagal");
        }

        // Processing succeeded — wait for refetch to complete THEN remove uploading row
        // This prevents the gap where both the row and the list item are absent
        await queryClient.invalidateQueries({ queryKey: ["documents"] });
        removeUploadingFile(uploadId);
        toast.success(`${file.name} berhasil diproses`, {
          description: "Dokumen sudah masuk ke knowledge base kamu.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload gagal";
        setUploadError(uploadId, message);

        // Refetch so failed document appears in list from server
        await queryClient.invalidateQueries({ queryKey: ["documents"] });

        // Remove uploading row after delay so user sees the error briefly
        setTimeout(() => removeUploadingFile(uploadId), 3000);
      }
    },
    [
      queryClient,
      addUploadingFile,
      setUploadProgress,
      setUploadError,
      removeUploadingFile,
    ],
  );

  return { uploadFile };
}
