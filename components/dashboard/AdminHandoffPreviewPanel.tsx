"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveAdminHandoffPreviewAction,
  getConversationPageAction,
} from "@/lib/actions/dashboard";
import type { AdminHandoffPreview } from "@/types/dashboard";

interface AdminHandoffPreviewPanelProps {
  orgId: string;
  initialPreview: AdminHandoffPreview | null;
}

const AdminHandoffPreviewPanel = ({
  orgId,
  initialPreview,
}: AdminHandoffPreviewPanelProps) => {
  const router = useRouter();
  const { data: preview } = useQuery({
    queryKey: ["dashboard", orgId, "admin-handoff"],
    queryFn: getActiveAdminHandoffPreviewAction,
    initialData: initialPreview,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const openConversation = useCallback(async () => {
    if (!preview) return;

    try {
      const page = await getConversationPageAction(preview.id);
      router.push(
        `/dashboard/conversations?page=${page}&highlight=${preview.id}`,
      );
    } catch {
      router.push(`/dashboard/conversations?highlight=${preview.id}`);
    }
  }, [preview, router]);

  return (
    <section
      className="card-base overflow-hidden border-t-4 border-t-(--color-brand)"
      aria-labelledby="admin-handoff-preview-title"
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-(--color-text-400)">
            Percakapan ditangani admin
          </p>
          <h2
            id="admin-handoff-preview-title"
            className="mt-1 text-[15px] font-bold text-(--color-text-900)"
          >
            {preview
              ? `#${preview.sessionId.slice(0, 8)}`
              : "Belum ada handoff aktif"}
          </h2>
        </div>
        {preview && (
          <button
            type="button"
            onClick={() => void openConversation()}
            className="rounded-[8px] bg-(--color-brand) px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-(--color-brand-dark) focus:outline-none focus:ring-2 focus:ring-(--color-brand)"
          >
            Buka →
          </button>
        )}
      </div>

      {preview ? (
        <div className="border-t border-(--color-border-sm) bg-(--color-bg-page)/55 px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-[10.5px]">
            <span className="rounded-full bg-(--color-warning-bg) px-2 py-1 font-bold text-(--color-warning)">
              MANUAL
            </span>
            <span className="text-(--color-text-400)">
              {preview.deliveryChannel}
            </span>
          </div>
          {preview.messages.length > 0 ? (
            <div className="space-y-2.5">
              {preview.messages.map((message) => {
                const isAdmin = message.role === "human_agent";

                return (
                  <div
                    key={message.id}
                    className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-[12px] px-3 py-2 text-[12px] leading-relaxed ${
                        isAdmin
                          ? "rounded-br-[4px] bg-(--color-brand) text-white"
                          : "rounded-bl-[4px] border border-(--color-border-sm) bg-(--color-bg-card) text-(--color-text-700)"
                      }`}
                    >
                      <p
                        className={`mb-0.5 text-[9.5px] font-bold ${
                          isAdmin ? "text-white/75" : "text-(--color-text-400)"
                        }`}
                      >
                        {isAdmin ? "Admin" : "Pelanggan"}
                      </p>
                      <p className="line-clamp-3 whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] leading-relaxed text-(--color-text-500)">
              Admin sudah mengambil alih percakapan ini. Pesan pelanggan dan
              balasan admin akan tampil di sini.
            </p>
          )}
          <p className="mt-3 text-[10.5px] text-(--color-text-400)">
            Preview hanya menampilkan percakapan yang sedang diambil alih.
          </p>
        </div>
      ) : (
        <div className="border-t border-(--color-border-sm) bg-(--color-bg-page)/55 px-5 py-5">
          <p className="text-[12.5px] font-medium text-(--color-text-700)">
            Belum ada percakapan yang sedang ditangani admin.
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-(--color-text-500)">
            Saat staff mengambil alih handoff, preview percakapan pelanggan dan
            admin akan muncul di sini.
          </p>
        </div>
      )}
    </section>
  );
};

export default AdminHandoffPreviewPanel;
