"use client";

import { motion } from "framer-motion";
import { staggerItem } from "@/lib/animations";

interface TopQuestionsCardProps {
  questions: { question: string; count: number }[];
}

const TopQuestionsCard = ({ questions }: TopQuestionsCardProps) => {
  // Max count — used to calculate fill width percentage for each bar
  const maxCount = Math.max(1, ...questions.map((q) => q.count));

  return (
    <motion.div variants={staggerItem} className="card-base p-6">
      {/* Card header */}
      <div className="mb-5">
        <h2 className="text-[15px] font-bold text-(--color-text-900)">
          Pertanyaan Terpopuler
        </h2>
        <p className="text-[12px] text-(--color-text-400) mt-0.5">
          Apa yang paling sering ditanyakan pelanggan kamu
        </p>
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
        <ol className="space-y-2.5">
          {questions.map((item, index) => {
            // Fill width — proportional to top question's count
            const fillPct = Math.round((item.count / maxCount) * 100);

            return (
              <li key={item.question} className="relative">
                {/* Bar fill — sits behind text, full width container */}
                <div className="relative rounded-[8px] overflow-hidden">
                  {/* Background fill — brand color at low opacity */}
                  <div
                    className="absolute inset-y-0 left-0 bg-(--color-brand-light) dark:bg-[rgba(6,148,148,0.12)] rounded-[8px] transition-all duration-700"
                    style={{ width: `${fillPct}%` }}
                    aria-hidden="true"
                  />

                  {/* Content row — sits on top of fill */}
                  <div className="relative flex items-center gap-3 px-3 py-2.5">
                    {/* Rank number */}
                    <span className="text-[11px] font-extrabold text-(--color-text-400) w-5 text-center flex-shrink-0">
                      {index + 1}
                    </span>

                    {/* Question text — truncated if too long */}
                    <span className="flex-1 text-[13px] text-(--color-text-700) font-medium truncate">
                      {item.question}
                    </span>

                    {/* Count badge */}
                    <span className="text-[11.5px] font-bold text-(--color-brand) bg-(--color-brand-light) px-2 py-0.5 rounded-full flex-shrink-0">
                      {item.count.toLocaleString("id-ID")}×
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </motion.div>
  );
};

export default TopQuestionsCard;
