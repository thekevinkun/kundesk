"use client";

import { motion } from "framer-motion";
import { ConversationRow, ConversationEmptyState } from "./conversations";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type { ConversationRow as ConversationRowType } from "@/types/api";

interface ConversationsPageProps {
  conversations: ConversationRowType[];
}

const ConversationsPage = ({ conversations }: ConversationsPageProps) => {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
          Percakapan
        </h1>
        <p className="text-[13px] text-(--color-text-500) mt-1">
          Semua percakapan pelanggan dengan chatbot kamu.
        </p>
      </div>

      {/* Table card */}
      <div className="card-base overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-(--color-border-sm)">
          <div>
            <div className="text-[15px] font-bold text-(--color-text-900)">
              Percakapan Terbaru
            </div>
            <div className="text-[11.5px] text-(--color-text-400) mt-0.5">
              {conversations.length > 0
                ? `${conversations.length} percakapan terakhir`
                : "Belum ada percakapan"}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Pesan", "Sesi", "Channel", "Status", "Waktu"].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400) bg-(--color-bg-page) border-b border-(--color-border-sm)"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {conversations.length === 0 ? (
                <ConversationEmptyState />
              ) : (
                conversations.map((convo) => (
                  <ConversationRow key={convo.id} convo={convo} />
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default ConversationsPage;
