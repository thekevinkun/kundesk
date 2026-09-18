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

      // Declared outside the try so the catch block can see them even if
      // failure happens before or during Step 2 (S3 PUT).
      let documentId: number | undefined;
      let putSucceeded = false;

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

        const { uploadUrl, s3Key, documentId: newDocumentId } = uploadJson.data;
        documentId = newDocumentId;

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
            if (xhr.status === 200) {
              putSucceeded = true;
              resolve();
            } else {
              reject(new Error(`Upload gagal: ${xhr.status}`));
            }
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

        // If the S3 PUT itself never succeeded, the "processing" row created
        // in Step 1 has no S3 object behind it and nothing will ever update
        // its status — /api/documents/process is never reached. Delete it
        // rather than leaving an orphaned row that silently consumes a
        // document-limit slot forever. If the PUT DID succeed and the
        // failure happened later (in /process), that route already marks
        // the row "failed" itself — don't delete it in that case.
        if (documentId !== undefined && !putSucceeded) {
          try {
            await fetch(`/api/documents/${documentId}`, {
              method: "DELETE",
            });
          } catch (cleanupErr) {
            console.error(
              "[useDocumentUpload] Failed to clean up orphaned document record:",
              cleanupErr,
            );
          }
        }

        setTimeout(() => {
          removeUploadingFile(uploadId);
          void queryClient.invalidateQueries({ queryKey: ["documents"] });
        }, 3000);
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
