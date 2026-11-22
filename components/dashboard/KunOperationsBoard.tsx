"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  operationsBoardKunVariants,
  operationsBoardQueueVariants,
} from "@/lib/animations";
import type { LiveOverviewSnapshot } from "@/types/dashboard";

interface KunOperationsBoardProps {
  bot: LiveOverviewSnapshot["bot"];
  queue: LiveOverviewSnapshot["queue"];
}

const KunOperationsBoard = ({ bot, queue }: KunOperationsBoardProps) => {
  const reduceMotion = useReducedMotion();
  const pending = queue.pendingHandoffCount > 0;
  return (
    <section
      className="card-base overflow-hidden"
      aria-labelledby="operations-board-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-(--color-border-sm) px-5 py-4">
        <div>
          <h2
            id="operations-board-title"
            className="text-[18px] font-bold tracking-[-0.03em] text-(--color-text-900)"
          >
            Kantor Operasional KUN
          </h2>
          <p className="mt-0.5 text-[11.5px] text-(--color-text-400)">
            Status ruang kerja KUN, antrean, tim, dan knowledge.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${pending ? "bg-(--color-danger-bg) text-(--color-danger)" : "bg-(--color-success-bg) text-(--color-success)"}`}
        >
          {pending ? "PERLU ATENSI" : "LIVE"}
        </span>
      </div>

      <div className="relative min-h-[330px] overflow-hidden bg-[linear-gradient(135deg,var(--color-brand-light),var(--color-bg-page)_58%,var(--color-brand-light))] p-4 sm:min-h-[370px]">
        <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(30deg,transparent_48%,var(--color-border)_49%,var(--color-border)_51%,transparent_52%),linear-gradient(150deg,transparent_48%,var(--color-border)_49%,var(--color-border)_51%,transparent_52%)] [background-size:44px_26px]" />
        <div className="pointer-events-none absolute left-1/2 top-[48%] h-[52%] w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-dashed border-(--color-brand-mid)" />
        <Link
          href="/dashboard/team"
          className="absolute left-[7%] top-[25%] z-10 rounded-[12px] bg-(--color-bg-card) px-3 py-2 shadow-sm transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-(--color-brand)"
        >
          <span className="block text-[11px] font-bold text-(--color-text-900)">
            Tim
          </span>
          <span className="block text-[10px] text-(--color-text-500)">
            Kelola anggota →
          </span>
        </Link>
        <Link
          href="/dashboard/knowledge"
          className="absolute right-[6%] top-[25%] z-10 rounded-[12px] bg-(--color-bg-card) px-3 py-2 shadow-sm transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-(--color-brand)"
        >
          <span className="block text-[11px] font-bold text-(--color-text-900)">
            Knowledge
          </span>
          <span className="block text-[10px] text-(--color-text-500)">
            {bot ? `${bot.documentCount} dokumen siap` : "Belum tersedia"} →
          </span>
        </Link>
        <Link
          href="/dashboard/conversations"
          className={`absolute bottom-[17%] left-[7%] z-10 rounded-[12px] px-3 py-2 shadow-sm transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-(--color-brand) ${pending ? "bg-(--color-danger-bg)" : "bg-(--color-bg-card)"}`}
        >
          <span className="block text-[11px] font-bold text-(--color-text-900)">
            Lobi Antrean
          </span>
          <span
            className={`block text-[10px] ${pending ? "text-(--color-danger)" : "text-(--color-text-500)"}`}
          >
            {pending
              ? `${queue.pendingHandoffCount} handoff menunggu`
              : `${queue.activeConversationCount} percakapan aktif`}{" "}
            →
          </span>
        </Link>
        <motion.div
          className="absolute left-1/2 top-[47%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          variants={operationsBoardKunVariants}
          initial="static"
          animate={bot?.isActive && !reduceMotion ? "active" : "static"}
        >
          <div className="absolute top-14 h-20 w-28 rounded-full bg-(--color-brand-mid)/55 blur-xl" />
          <div className="relative flex size-20 items-center justify-center rounded-full border-4 border-(--color-bg-card) bg-(--color-brand-light) shadow-lg sm:size-24">
            <Image
              src="/images/kun_logo.png"
              alt="KUN"
              width={70}
              height={60}
              className="h-14 w-auto object-contain sm:h-16"
              priority
            />
          </div>
          <div className="relative mt-3 w-36 [transform:skewY(-8deg)] rounded-[6px] border border-(--color-brand-mid) bg-(--color-bg-card) px-3 py-2 text-center shadow-sm">
            <span className="block [transform:skewY(8deg)] text-[11px] font-bold text-(--color-brand)">
              KUN {bot?.isActive ? "AKTIF" : "NONAKTIF"}
            </span>
          </div>
          <Link
            href="/dashboard/chatbot"
            className="relative mt-3 rounded-full bg-(--color-brand) px-3 py-1.5 text-[10.5px] font-bold text-white shadow-sm hover:bg-(--color-brand-dark) focus:outline-none focus:ring-2 focus:ring-(--color-brand)"
          >
            Buka konfigurasi
          </Link>
        </motion.div>
        <motion.div
          key={`${queue.activeConversationCount}-${queue.pendingHandoffCount}`}
          className="absolute bottom-[17%] right-[7%] z-10"
          variants={operationsBoardQueueVariants}
          initial="static"
          animate={reduceMotion ? "static" : pending ? "urgent" : "message"}
        >
          <div className="rounded-[12px] bg-(--color-bg-card) px-3 py-2 shadow-sm">
            <span className="block text-[11px] font-bold text-(--color-text-900)">
              Status KUN
            </span>
            <span className="block text-[10px] text-(--color-text-500)">
              {bot?.isActive ? "Menjawab otomatis" : "Tidak melayani chat"}
            </span>
          </div>
        </motion.div>
        <div className="absolute inset-x-4 bottom-4 z-10 flex items-center justify-between rounded-[10px] border border-(--color-border) bg-(--color-bg-card)/90 px-3 py-2 text-[10.5px] backdrop-blur">
          <span className="font-semibold text-(--color-text-700)">
            Peta operasional
          </span>
          <span className="text-(--color-text-500)">
            {queue.activeConversationCount} aktif · {queue.pendingHandoffCount}{" "}
            tertunda
          </span>
        </div>
      </div>
      <p className="border-t border-(--color-border-sm) px-5 py-3 text-[11px] text-(--color-text-500)">
        KUN {bot?.isActive ? "aktif" : "nonaktif"}; status Tim di papan ini
        hanya tautan, bukan indikator kehadiran.
      </p>
    </section>
  );
};

export default KunOperationsBoard;
