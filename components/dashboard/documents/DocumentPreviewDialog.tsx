"use client";

// Preview dialog for one document — two views:
// "kun"      = the chunks KUN actually learned (works for every format, reads from Neon)
// "original" = the stored file (PDF inline, other formats download only)

import { useRef, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPreviewKind } from "@/helpers/document-preview";
import type { DocumentSelect } from "@/types/db";
import type { ApiResponse } from "@/types/api";
import type { ChunksPage, FileLinkData } from "@/types/document-preview";

type View = "kun" | "original";

interface DocumentPreviewDialogProps {
  // The dialog only reads the id and name, so the dashboard can open it without a full row
  doc: Pick<DocumentSelect, "id" | "name">;
  onClose: () => void;
}

// Shared look for the two view buttons
const viewButtonClass = (active: boolean) =>
  `px-3 py-1.5 rounded-(--radius-sm) text-[12.5px] font-semibold border transition-colors ${
    active
      ? "bg-(--color-brand-light) text-(--color-brand-dark) border-(--color-brand-mid)"
      : "text-(--color-text-500) border-(--color-border) hover:bg-(--color-bg-page)"
  }`;

const actionButtonClass =
  "px-3 py-1.5 rounded-(--radius-sm) text-[12.5px] font-semibold bg-(--color-brand) text-white hover:bg-(--color-brand-dark) disabled:opacity-50";

const DocumentPreviewDialog = ({
  doc,
  onClose,
}: DocumentPreviewDialogProps) => {
  // Starts on the KUN text — it works for every format
  const [view, setView] = useState<View>("kun");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const previewKind = getPreviewKind(doc.name);
  // Cache keys carry the org so switching org never shows another org's entries
  const { organization } = useOrganization();
  const orgId = organization?.id;
  // The element that opened the dialog — the parent unmounts us on close,
  // so focus must be handed back from here
  const openerRef = useRef<HTMLElement | null>(null);

  // ── KUN text: 20 chunks per page, "Muat lebih banyak" loads the next page ──
  const chunksQuery = useInfiniteQuery({
    queryKey: ["documents", orgId, doc.id, "chunks"],
    enabled: Boolean(orgId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await fetch(
        `/api/documents/${doc.id}/chunks?page=${pageParam}`,
      );
      const json = (await res.json()) as ApiResponse<ChunksPage>;
      if (!json.ok) throw new Error("Gagal memuat teks dokumen");
      return json.data;
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  // ── Original file link: only asked for when that view is open ──
  // staleTime/gcTime 0 — the link lives 60 seconds, so it is never reused
  const fileQuery = useQuery({
    queryKey: ["documents", orgId, doc.id, "file"],
    enabled: Boolean(orgId) && view === "original",
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const res = await fetch(`/api/documents/${doc.id}/file`);
      const json = (await res.json()) as ApiResponse<FileLinkData>;
      if (!json.ok) throw new Error("Gagal memuat file");
      return json.data;
    },
  });

  // Asks the server for a fresh 60-second link — the one on screen may have expired
  const fetchFreshLink = async (
    mode: "inline" | "download",
  ): Promise<string> => {
    const res = await fetch(`/api/documents/${doc.id}/file?mode=${mode}`);
    const json = (await res.json()) as ApiResponse<FileLinkData>;
    if (!json.ok || !json.data.available) throw new Error("unavailable");
    return json.data.url;
  };

  // Starts the download with a fresh "attachment" link
  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadFailed(false);
    try {
      window.location.assign(await fetchFreshLink("download"));
    } catch {
      setDownloadFailed(true);
    } finally {
      setIsDownloading(false);
    }
  };

  // Opens the PDF in a new tab with a fresh link.
  // The tab is opened first, inside the click, so popup blockers allow it;
  // it is pointed at the link once the server answers.
  const handleOpenNewTab = async () => {
    setIsDownloading(true);
    setDownloadFailed(false);
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const url = await fetchFreshLink("inline");
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch {
      tab?.close();
      setDownloadFailed(true);
    } finally {
      setIsDownloading(false);
    }
  };

  const allChunks = chunksQuery.data?.pages.flatMap((p) => p.chunks) ?? [];
  const file = fileQuery.data;

  return (
    // Mounted only while open, so onOpenChange only ever means "close"
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-3xl w-[95vw] max-h-[90vh] flex flex-col gap-3"
        onOpenAutoFocus={() => {
          // Remember what had focus (the document name) before the dialog took it
          const active = document.activeElement;
          openerRef.current = active instanceof HTMLElement ? active : null;
        }}
        onCloseAutoFocus={(event) => {
          // No DialogTrigger exists, so hand focus back by hand
          event.preventDefault();
          const opener = openerRef.current;
          if (opener?.isConnected) opener.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="break-words pr-6">{doc.name}</DialogTitle>
          <DialogDescription>
            Periksa isi dokumen sebelum kamu memutuskan untuk menghapusnya.
          </DialogDescription>
        </DialogHeader>

        {/* View switch */}
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={view === "kun"}
            onClick={() => setView("kun")}
            className={viewButtonClass(view === "kun")}
          >
            Teks yang dipelajari KUN
          </button>
          <button
            type="button"
            aria-pressed={view === "original"}
            onClick={() => setView("original")}
            className={viewButtonClass(view === "original")}
          >
            File asli
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* ── View 1: what KUN learned ── */}
          {view === "kun" && (
            <div aria-live="polite">
              {chunksQuery.isPending && (
                <p className="text-[13px] text-(--color-text-400)">Memuat...</p>
              )}
              {chunksQuery.isError && (
                <p className="text-[13px] text-(--color-danger)">
                  Gagal memuat teks dokumen. Tutup lalu buka lagi.
                </p>
              )}
              {!chunksQuery.isPending &&
                !chunksQuery.isError &&
                allChunks.length === 0 && (
                  <p className="text-[13px] text-(--color-text-500)">
                    KUN belum mempelajari teks apa pun dari dokumen ini.
                  </p>
                )}
              <ol className="space-y-3">
                {allChunks.map((chunk, index) => (
                  <li
                    key={chunk.id}
                    className="rounded-(--radius-sm) border border-(--color-border) p-3"
                  >
                    <div className="text-[11.5px] font-semibold text-(--color-text-400) mb-1">
                      Potongan {index + 1}
                    </div>
                    <p className="text-[13px] text-(--color-text-700) whitespace-pre-wrap break-words">
                      {chunk.content}
                    </p>
                  </li>
                ))}
              </ol>
              {chunksQuery.hasNextPage && (
                <button
                  type="button"
                  onClick={() => void chunksQuery.fetchNextPage()}
                  disabled={chunksQuery.isFetchingNextPage}
                  className={`${viewButtonClass(false)} mt-3`}
                >
                  {chunksQuery.isFetchingNextPage
                    ? "Memuat..."
                    : "Muat lebih banyak"}
                </button>
              )}
            </div>
          )}

          {/* ── View 2: the original file ── */}
          {view === "original" && (
            <div aria-live="polite">
              {fileQuery.isPending && (
                <p className="text-[13px] text-(--color-text-400)">Memuat...</p>
              )}
              {fileQuery.isError && (
                <p className="text-[13px] text-(--color-danger)">
                  Gagal memuat file asli. Tutup lalu buka lagi.
                </p>
              )}
              {file && !file.available && (
                <p className="text-[13px] text-(--color-text-500)">
                  File asli tidak tersedia. Teks yang dipelajari KUN tetap bisa
                  dilihat di tab sebelumnya.
                </p>
              )}
              {file?.available && previewKind === "pdf" && (
                <div className="space-y-2">
                  <iframe
                    src={file.url}
                    title={`Pratinjau ${doc.name}`}
                    className="w-full h-[60vh] rounded-(--radius-sm) border border-(--color-border)"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenNewTab()}
                      disabled={isDownloading}
                      className={viewButtonClass(false)}
                    >
                      Buka di tab baru
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownload()}
                      disabled={isDownloading}
                      className={actionButtonClass}
                    >
                      {isDownloading ? "Menyiapkan..." : "Download"}
                    </button>
                  </div>
                </div>
              )}
              {file?.available && previewKind === "other" && (
                <div className="space-y-3">
                  <p className="text-[13px] text-(--color-text-500)">
                    Pratinjau file asli hanya tersedia untuk PDF. Isi dokumen
                    ini bisa kamu lihat di tab &quot;Teks yang dipelajari
                    KUN&quot;.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    disabled={isDownloading}
                    className={actionButtonClass}
                  >
                    {isDownloading ? "Menyiapkan..." : "Download"}
                  </button>
                </div>
              )}
              {downloadFailed && (
                <p className="text-[12.5px] text-(--color-danger) mt-2">
                  Gagal membuka file. Coba lagi.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreviewDialog;
