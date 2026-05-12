"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";

// ── Language label — maps DB value to display string ──
const languageLabel: Record<string, string> = {
  id: "🇮🇩 Bahasa Indonesia",
  en: "🇬🇧 English",
  both: "🇮🇩 ID + 🇬🇧 EN",
};

// ── Tone label ──
const toneLabel: Record<string, string> = {
  friendly: "Ramah",
  professional: "Profesional",
  formal: "Formal",
};

interface BotStatusPanelProps {
  orgSlug: string;
  name: string;
  language: string;
  tone: string;
  isActive: boolean;
  accentColor: string;
  documentCount: number;
  totalChunks: number;
  messagesUsed: number;
  messagesLimit: number;
}

// ── Status row — label + value pair ──
const StatusRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between px-5 py-3 border-b border-(--color-border-sm) last:border-0">
    <span className="text-[13px] text-(--color-text-500)">{label}</span>
    <span className="text-[13px] font-semibold text-(--color-text-900) flex items-center gap-1.5">
      {children}
    </span>
  </div>
);

const BotStatusPanel = ({
  orgSlug,
  name,
  language,
  tone,
  isActive,
  documentCount,
  totalChunks,
  messagesUsed,
  messagesLimit,
}: BotStatusPanelProps) => {
  // Usage percentage — clamped to 100 max
  const usagePct =
    messagesLimit > 0
      ? Math.min(Math.max((messagesUsed / messagesLimit) * 100, 0), 100)
      : 0;

  // Usage bar color — green < 70%, amber 70–90%, red > 90%
  const usageBarColor =
    usagePct > 90
      ? "bg-(--color-danger)"
      : usagePct > 70
        ? "bg-(--color-warning)"
        : "bg-(--color-brand)";

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="card-base overflow-hidden"
    >
      {/* Card header — title + live indicator */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-(--color-border-sm)">
        <div className="text-[15px] font-bold text-(--color-text-900)">
          Status Chatbot
        </div>
        {/* Live indicator — green pulse when active */}
        <div
          className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
            isActive
              ? "bg-(--color-success-bg) text-(--color-success)"
              : "bg-(--color-bg-page) text-(--color-text-400) border border-(--color-border)"
          }`}
        >
          {isActive && <div className="live-dot" />}
          {isActive ? "AKTIF" : "NONAKTIF"}
        </div>
      </div>

      {/* Usage bar — quota consumed this month */}
      <div className="px-5 py-4 border-b border-(--color-border-sm)">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-(--color-text-700)">
            Kuota Pesan
          </span>
          <span className="text-[12.5px] text-(--color-text-500)">
            <strong className="text-(--color-text-900)">
              {messagesUsed.toLocaleString("id-ID")}
            </strong>{" "}
            / {messagesLimit.toLocaleString("id-ID")}
          </span>
        </div>
        {/* Track */}
        <div className="h-2 bg-(--color-bg-page) border border-(--color-border) rounded-full overflow-hidden">
          {/* Fill — width animates from 0 on mount */}
          <motion.div
            className={`h-full rounded-full ${usageBarColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${usagePct}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="text-[11.5px] text-(--color-text-400) mt-1.5">
          Reset tiap bulan ·{" "}
          <Link
            href="/dashboard/billing"
            className="text-(--color-brand) font-semibold hover:underline"
          >
            Upgrade plan →
          </Link>
        </div>
      </div>

      {/* Status rows */}
      <div>
        <StatusRow label="Nama Bot">{name}</StatusRow>
        <StatusRow label="Bahasa">
          {languageLabel[language] ?? language}
        </StatusRow>
        <StatusRow label="Nada Bicara">{toneLabel[tone] ?? tone}</StatusRow>
        <StatusRow label="Dokumen">
          {documentCount} file · {totalChunks.toLocaleString("id-ID")} chunks
        </StatusRow>
        <StatusRow label="URL Publik">
          <Link
            href={`/chat/${orgSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[12px] text-(--color-brand) bg-(--color-brand-light) border border-(--color-brand-mid) px-2 py-0.5 rounded-[5px] hover:bg-(--color-brand-mid) transition-colors"
          >
            /chat/{orgSlug}
          </Link>
        </StatusRow>
      </div>

      {/* Quick actions */}
      <div className="px-5 py-4 border-t border-(--color-border-sm) flex gap-2">
        <Link
          href="/dashboard/chatbot"
          className="flex-1 text-center text-[12.5px] font-semibold py-2 rounded-[8px] bg-(--color-bg-page) border border-(--color-border) text-(--color-text-700) hover:border-(--color-brand) hover:text-(--color-brand) transition-all"
        >
          ⚙️ Konfigurasi
        </Link>
        <Link
          href={`/chat/${orgSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-[12.5px] font-semibold py-2 rounded-[8px] bg-(--color-brand) text-white hover:bg-(--color-brand-dark) transition-all"
        >
          🔗 Buka Chat
        </Link>
      </div>
    </motion.div>
  );
};

export default BotStatusPanel;
