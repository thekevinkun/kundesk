"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { useConversationStore } from "@/stores/conversation-store";
import { deriveSceneState } from "@/helpers/live-scene";
import {
  getConversationPageAction,
  getLiveConversationPreviewAction,
} from "@/lib/actions/dashboard";
import {
  liveWorkspaceKunVariants,
  liveWorkspacePacketVariants,
} from "@/lib/animations";
import type {
  LiveConversationPreview,
  LiveOverviewSnapshot,
} from "@/types/dashboard";

interface LiveConversationWorkspaceProps {
  orgId: string;
  bot: LiveOverviewSnapshot["bot"];
  initialPreview: LiveConversationPreview | null;
  // Live quota numbers from the dashboard — drive KUN's quota pose
  quotaUsed: number;
  quotaLimit: number;
}

type PacketVariant =
  | "leftToCenter"
  | "centerToLeft"
  | "centerToRight"
  | "rightToCenter"
  | "leftToRight"
  | "rightToLeft";

const eventToPacket: Record<
  NonNullable<
    ReturnType<typeof useConversationStore.getState>["liveWorkspaceEvent"]
  >["type"],
  { variant: PacketVariant; position: string }
> = {
  "customer-to-kun": { variant: "leftToCenter", position: "left-[23%]" },
  "kun-to-customer": { variant: "centerToLeft", position: "left-1/2" },
  "customer-to-admin": { variant: "leftToRight", position: "left-[23%]" },
  "admin-to-customer": { variant: "rightToLeft", position: "left-[77%]" },
  "kun-to-admin": { variant: "centerToRight", position: "left-1/2" },
  "admin-to-kun": { variant: "rightToCenter", position: "left-[77%]" },
};

const sessionInitials = (sessionId: string | undefined) =>
  sessionId ? sessionId.slice(0, 2).toUpperCase() : "P";

const roleLabel = (
  role: LiveConversationPreview["messages"][number]["role"],
) => (role === "user" ? "Pelanggan" : role === "assistant" ? "KUN" : "Admin");

const LiveConversationWorkspace = ({
  orgId,
  bot,
  initialPreview,
  quotaUsed,
  quotaLimit,
}: LiveConversationWorkspaceProps) => {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const liveEvent = useConversationStore((s) => s.liveWorkspaceEvent);
  // Id of the event already in the store at mount — it was played (or missed) before this component existed
  const [mountedEventId] = useState(
    () => useConversationStore.getState().liveWorkspaceEvent?.id ?? 0,
  );
  const { data: preview } = useQuery({
    queryKey: ["dashboard", orgId, "live-conversation"],
    queryFn: getLiveConversationPreviewAction,
    initialData: initialPreview,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  // Only events that arrived AFTER mount may animate — stops old packets replaying on remount
  const freshEvent =
    liveEvent && liveEvent.id > mountedEventId ? liveEvent : null;
  const packet = freshEvent ? eventToPacket[freshEvent.type] : null;
  // The logged-in user — gives the admin desk a real name
  const { user } = useUser();
  // One derived scene state — poses and labels come from tested rules, not inline ternaries
  const scene = deriveSceneState({
    preview: preview ?? null,
    botActive: bot?.isActive ?? false,
    quotaUsed,
    quotaLimit,
    viewerUserId: user?.id ?? null,
    viewerName: user?.firstName ?? user?.fullName ?? null,
  });
  const isManual = scene.mode === "manual";
  const isPending = scene.mode === "pending";
  const stateLabel = scene.statusLabel;

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
      className="card-base overflow-hidden"
      aria-labelledby="live-workspace-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-(--color-border-sm) px-5 py-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-(--color-text-400)">
            Layanan pelanggan real-time
          </p>
          <h2
            id="live-workspace-title"
            className="mt-1 text-[18px] font-bold tracking-[-0.03em] text-(--color-text-900)"
          >
            Ruang Percakapan Live
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            isPending
              ? "bg-(--color-danger-bg) text-(--color-danger)"
              : isManual
                ? "bg-(--color-warning-bg) text-(--color-warning)"
                : "bg-(--color-success-bg) text-(--color-success)"
          }`}
        >
          {isPending ? "MENUNGGU ADMIN" : isManual ? "MANUAL" : "KUN AKTIF"}
        </span>
      </div>

      <div className="relative min-h-[310px] overflow-hidden bg-[linear-gradient(135deg,var(--color-brand-light),var(--color-bg-page)_58%,var(--color-brand-light))] px-4 py-5 sm:min-h-[340px]">
        <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(30deg,transparent_48%,var(--color-border)_49%,var(--color-border)_51%,transparent_52%),linear-gradient(150deg,transparent_48%,var(--color-border)_49%,var(--color-border)_51%,transparent_52%)] [background-size:44px_26px]" />
        <div className="relative mx-auto h-[270px] max-w-[590px]">
          <div className="absolute left-[17%] top-[57%] h-px w-[33%] -rotate-[18deg] bg-(--color-brand-mid)" />
          <div
            className={`absolute left-1/2 top-[57%] h-px w-[33%] rotate-[18deg] ${isManual || isPending ? "bg-(--color-warning)" : "bg-(--color-border)"}`}
          />
          {freshEvent && packet && !reduceMotion && (
            <motion.span
              key={freshEvent.id}
              className={`absolute top-[56%] z-20 size-2.5 rounded-full bg-(--color-brand) shadow-[0_0_0_5px_var(--color-brand-light)] ${packet.position}`}
              variants={liveWorkspacePacketVariants}
              initial={{ opacity: 0 }}
              animate={packet.variant}
            />
          )}

          <div className="absolute left-[18%] top-[51%] flex w-24 -translate-x-1/2 flex-col items-center text-center">
            <div className="relative flex size-14 items-center justify-center rounded-full border-4 border-(--color-bg-card) bg-(--color-info-bg) text-[13px] font-extrabold text-(--color-info) shadow-lg">
              {sessionInitials(preview?.sessionId)}
            </div>
            <div className="mt-[-7px] size-12 rotate-45 border border-(--color-brand-mid) bg-(--color-bg-card) shadow-sm" />
            <span className="relative -mt-8 text-[11px] font-bold text-(--color-text-900)">
              Pelanggan
            </span>
            <span className="relative mt-0.5 text-[9.5px] text-(--color-text-500)">
              {preview
                ? `#${preview.sessionId.slice(0, 8)}`
                : "Belum ada chat aktif"}
            </span>
          </div>

          <motion.div
            className="absolute left-1/2 top-[13%] z-10 flex w-32 -translate-x-1/2 flex-col items-center text-center"
            variants={liveWorkspaceKunVariants}
            initial="static"
            animate={bot?.isActive && !reduceMotion ? "active" : "static"}
          >
            <div className="absolute top-14 h-24 w-32 rounded-full bg-(--color-brand-mid)/65 blur-xl" />
            <div className="relative flex size-24 items-center justify-center rounded-full border-4 border-(--color-bg-card) bg-(--color-brand-light) shadow-xl">
              <Image
                src="/images/kun_logo.png"
                alt="KUN"
                width={70}
                height={60}
                className="h-16 w-auto object-contain"
                priority
              />
            </div>
            <div className="relative mt-[-8px] size-16 rotate-45 border border-(--color-brand-mid) bg-(--color-bg-card) shadow-md" />
            <span className="relative -mt-10 rounded-full bg-(--color-brand) px-3 py-1 text-[10.5px] font-bold text-white shadow-sm">
              KUN {bot?.isActive ? "AKTIF" : "NONAKTIF"}
            </span>
          </motion.div>

          <div className="absolute right-[18%] top-[51%] flex w-24 translate-x-1/2 flex-col items-center text-center">
            <div
              className={`relative flex size-14 items-center justify-center rounded-full border-4 border-(--color-bg-card) text-[13px] font-extrabold shadow-lg ${isManual ? "bg-(--color-warning-bg) text-(--color-warning)" : "bg-(--color-bg-page) text-(--color-text-400)"}`}
            >
              A
            </div>
            <div className="mt-[-7px] size-12 rotate-45 border border-(--color-border) bg-(--color-bg-card) shadow-sm" />
            <span className="relative -mt-8 text-[11px] font-bold text-(--color-text-900)">
              Admin
            </span>
            <span className="relative mt-0.5 text-[9.5px] text-(--color-text-500)">
              {isManual ? "Menangani sesi" : "Saat takeover"}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <span className="rounded-full border border-(--color-border) bg-(--color-bg-card)/90 px-3 py-1.5 text-[10.5px] font-semibold text-(--color-text-700) shadow-sm backdrop-blur">
              <span
                className={`mr-1.5 inline-block size-1.5 rounded-full ${isPending ? "bg-(--color-danger)" : isManual ? "bg-(--color-warning)" : "bg-(--color-success)"}`}
              />
              {stateLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-(--color-border-sm) bg-(--color-bg-page)/55 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-(--color-text-400)">
              Percakapan live terbaru
            </p>
            <h3 className="mt-1 text-[15px] font-bold text-(--color-text-900)">
              {preview
                ? `#${preview.sessionId.slice(0, 8)}`
                : "Belum ada percakapan dalam 24 jam terakhir"}
            </h3>
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
          <div className="mt-3 space-y-2.5">
            {preview.messages.map((message) => {
              const isCustomer = message.role === "user";
              const isKun = message.role === "assistant";
              return (
                <div
                  key={message.id}
                  className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-[12px] px-3 py-2 text-[12px] leading-relaxed ${isCustomer ? "rounded-bl-[4px] border border-(--color-border-sm) bg-(--color-bg-card) text-(--color-text-700)" : isKun ? "rounded-br-[4px] bg-(--color-brand-light) text-(--color-text-700)" : "rounded-br-[4px] bg-(--color-brand) text-white"}`}
                  >
                    <p
                      className={`mb-0.5 text-[9.5px] font-bold ${message.role === "human_agent" ? "text-white/75" : "text-(--color-text-400)"}`}
                    >
                      {roleLabel(message.role)}
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
          <p className="mt-2 text-[11.5px] leading-relaxed text-(--color-text-500)">
            Saat pelanggan mulai chat, percakapan terbaru yang benar-benar aktif
            akan tampil di sini.
          </p>
        )}
      </div>
    </section>
  );
};

export default LiveConversationWorkspace;
