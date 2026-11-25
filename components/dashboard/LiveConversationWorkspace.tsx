"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";
import {
  AdminAvatar,
  CustomerAvatar,
  KunRobot,
} from "@/components/dashboard/live-scene";
import { getAvatarLook } from "@/helpers/avatar-look";
import { deriveSceneState } from "@/helpers/live-scene";
import {
  getConversationPageAction,
  getLiveConversationPreviewAction,
} from "@/lib/actions/dashboard";
import { liveWorkspacePacketVariants } from "@/lib/animations";
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
  // Stable faces: the customer from the session, the admin from whoever owns the desk
  const customerLook = getAvatarLook(preview?.sessionId);
  const adminSeed =
    scene.adminOwnership === "other" ? preview?.takenOverBy : user?.id;
  const adminLook = getAvatarLook(adminSeed);
  // Motion is allowed unless the visitor asked for reduced motion
  const animated = !reduceMotion;
  // KUN pill text and color follow the robot's pose
  const kunLabel =
    scene.kunPose === "off"
      ? "KUN NONAKTIF"
      : scene.kunPose === "tired"
        ? "KUOTA PENUH"
        : "KUN AKTIF";
  const kunPillClass =
    scene.kunPose === "off"
      ? "bg-(--color-text-400)"
      : scene.kunPose === "tired"
        ? "bg-(--color-warning)"
        : "bg-(--color-brand)";

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

      <div className="relative overflow-hidden bg-[linear-gradient(135deg,var(--color-brand-light),var(--color-bg-page)_58%,var(--color-brand-light))] px-4 py-5">
        <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(30deg,transparent_48%,var(--color-border)_49%,var(--color-border)_51%,transparent_52%),linear-gradient(150deg,transparent_48%,var(--color-border)_49%,var(--color-border)_51%,transparent_52%)] [background-size:44px_26px]" />
        {/* Fixed-ratio stage — characters, threads and labels scale together */}
        <div className="relative mx-auto aspect-[59/33] w-full max-w-[590px]">
          {/* Floor threads join the three tiles; the KUN–admin thread turns amber during a handoff */}
          <svg
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden="true"
            focusable="false"
          >
            <line
              x1="18%"
              y1="60.6%"
              x2="50%"
              y2="57.1%"
              className="stroke-(--color-brand-mid)"
              strokeWidth={2}
              strokeDasharray="5 6"
              strokeLinecap="round"
            />
            <line
              x1="50%"
              y1="57.1%"
              x2="82%"
              y2="60.6%"
              className={
                isManual || isPending
                  ? "stroke-(--color-warning)"
                  : "stroke-(--color-border)"
              }
              strokeWidth={2}
              strokeDasharray="5 6"
              strokeLinecap="round"
            />
          </svg>
          {freshEvent && packet && !reduceMotion && (
            <motion.span
              key={freshEvent.id}
              className={`absolute top-[59%] z-20 size-2.5 rounded-full bg-(--color-brand) shadow-[0_0_0_5px_var(--color-brand-light)] ${packet.position}`}
              variants={liveWorkspacePacketVariants}
              initial={{ opacity: 0 }}
              animate={packet.variant}
            />
          )}

          {/* Customer — left */}
          <div className="absolute left-[18%] top-[14%] z-10 flex w-[23%] -translate-x-1/2 flex-col items-center text-center">
            <CustomerAvatar
              pose={scene.customerPose}
              look={customerLook}
              animated={animated}
            />
            <span className="-mt-1 text-[11px] font-bold text-(--color-text-900)">
              Pelanggan
            </span>
            <span className="max-w-full truncate text-[9.5px] text-(--color-text-500)">
              {scene.channelLabel && scene.sessionLabel
                ? `${scene.channelLabel} ${scene.sessionLabel}`
                : "Belum ada chat aktif"}
            </span>
          </div>

          {/* KUN — center */}
          <div className="absolute left-1/2 top-[2%] z-10 flex w-[30%] -translate-x-1/2 flex-col items-center text-center">
            <KunRobot pose={scene.kunPose} animated={animated} />
            <span
              className={`-mt-1 rounded-full px-3 py-1 text-[10.5px] font-bold text-white shadow-sm ${kunPillClass}`}
            >
              {kunLabel}
            </span>
          </div>

          {/* Admin — right */}
          <div className="absolute left-[82%] top-[14%] z-10 flex w-[23%] -translate-x-1/2 flex-col items-center text-center">
            <AdminAvatar
              pose={scene.adminPose}
              look={adminLook}
              animated={animated}
            />
            <span className="-mt-1 max-w-full truncate text-[11px] font-bold text-(--color-text-900)">
              {scene.adminName}
            </span>
            <span className="text-[9.5px] text-(--color-text-500)">
              {isPending
                ? "Menunggu respons"
                : isManual
                  ? "Menangani sesi"
                  : "Saat takeover"}
            </span>
          </div>
        </div>

        {/* Status line below the stage — announced politely when it changes */}
        <div className="relative mt-3 flex justify-center">
          <span
            role="status"
            className="rounded-full border border-(--color-border) bg-(--color-bg-card)/90 px-3 py-1.5 text-[10.5px] font-semibold text-(--color-text-700) shadow-sm backdrop-blur"
          >
            <span
              className={`mr-1.5 inline-block size-1.5 rounded-full ${isPending ? "bg-(--color-danger)" : isManual ? "bg-(--color-warning)" : "bg-(--color-success)"}`}
            />
            {stateLabel}
          </span>
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
