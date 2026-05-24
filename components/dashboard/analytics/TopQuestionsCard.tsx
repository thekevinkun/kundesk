"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { staggerItem } from "@/lib/animations";
import type { QuestionCluster } from "@/lib/ai/cluster";

interface TopQuestionsCardProps {
  questions: QuestionCluster[];
}

const TopQuestionsCard = ({ questions }: TopQuestionsCardProps) => {
  // Track which cluster is expanded to show example questions
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const maxCount = Math.max(1, ...questions.map((q) => q.count));

  return (
    <motion.div variants={staggerItem} className="card-base p-6">
      {/* Card header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-bold text-(--color-text-900)">
            Topik Pertanyaan
          </h2>
          <p className="text-[12px] text-(--color-text-400) mt-0.5">
            Dikelompokkan berdasarkan makna oleh AI
          </p>
        </div>

        {/* AI badge — tells owner this is smart grouping */}
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-(--color-brand) bg-(--color-brand-light) border border-(--color-brand-mid) px-2.5 py-1 rounded-full flex-shrink-0">
          ✦ AI Grouped
        </span>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-[32px] mb-3">💬</span>
          <p className="text-[13px] text-(--color-text-500) font-medium">
            Belum ada pertanyaan
          </p>
          <p className="text-[12px] text-(--color-text-400) mt-1">
            Data akan muncul setelah pelanggan mulai bertanya
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {questions.map((item, index) => {
            const fillPct = Math.round((item.count / maxCount) * 100);
            const isExpanded = expandedIndex === index;
            const hasExamples = item.examples.length > 0;

            return (
              <li key={`${item.topic}-${index}`}>
                {/* Cluster row — clickable if has examples */}
                <button
                  type="button"
                  onClick={() =>
                    hasExamples && setExpandedIndex(isExpanded ? null : index)
                  }
                  aria-expanded={hasExamples ? isExpanded : undefined}
                  aria-controls={
                    hasExamples ? `cluster-examples-${index}` : undefined
                  }
                  className={`relative rounded-[10px] overflow-hidden transition-all duration-200 ${
                    hasExamples
                      ? "cursor-pointer hover:ring-1 hover:ring-(--color-brand-mid)"
                      : ""
                  } ${isExpanded ? "ring-1 ring-(--color-brand-mid)" : ""}`}
                >
                  {/* Background fill bar */}
                  <div
                    className="absolute inset-y-0 left-0 bg-(--color-brand-light) rounded-[10px] transition-all duration-700"
                    style={{ width: `${fillPct}%` }}
                    aria-hidden="true"
                  />

                  {/* Content */}
                  <div className="relative flex items-center gap-3 px-3 py-2.5">
                    {/* Rank */}
                    <span className="text-[11px] font-extrabold text-(--color-text-400) w-5 text-center flex-shrink-0">
                      {index + 1}
                    </span>

                    {/* Topic label */}
                    <span className="flex-1 text-[13px] text-(--color-text-700) font-semibold truncate">
                      {item.topic}
                    </span>

                    {/* Right side — count + expand chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11.5px] font-bold text-(--color-brand) bg-(--color-brand-light) px-2 py-0.5 rounded-full">
                        {item.count.toLocaleString("id-ID")}×
                      </span>
                      {hasExamples && (
                        <span
                          className={`text-[14px] text-(--color-text-400) transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        >
                          ›
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded examples — slide open */}
                <AnimatePresence initial={false}>
                  {isExpanded && hasExamples && (
                    <motion.div
                      id={`cluster-examples-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{
                        height: "auto",
                        opacity: 1,
                        transition: {
                          height: {
                            duration: 0.25,
                            ease: [0.22, 1, 0.36, 1] as [
                              number,
                              number,
                              number,
                              number,
                            ],
                          },
                          opacity: { duration: 0.2, delay: 0.05 },
                        },
                      }}
                      exit={{
                        height: 0,
                        opacity: 0,
                        transition: {
                          height: {
                            duration: 0.2,
                            ease: [0.22, 1, 0.36, 1] as [
                              number,
                              number,
                              number,
                              number,
                            ],
                          },
                          opacity: { duration: 0.1 },
                        },
                      }}
                      className="overflow-hidden"
                    >
                      {/* Example questions */}
                      <div className="mt-1 ml-8 space-y-1 pb-1">
                        {item.examples.map((ex, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 px-3 py-1.5 rounded-[8px] bg-(--color-bg-page) border border-(--color-border-sm)"
                          >
                            <span className="text-[10px] text-(--color-text-400) mt-0.5 flex-shrink-0">
                              "{`}`}
                            </span>
                            <span className="text-[12px] text-(--color-text-500) leading-relaxed">
                              {ex}
                            </span>
                          </div>
                        ))}
                        <p className="text-[10.5px] text-(--color-text-400) px-1 pt-0.5">
                          Contoh pertanyaan dari pelanggan
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      )}
    </motion.div>
  );
};

export default TopQuestionsCard;
