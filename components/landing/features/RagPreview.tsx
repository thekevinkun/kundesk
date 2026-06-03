"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { chatBubbleIn } from "@/lib/animations";

// Chat script — plays through in sequence then loops
const CHAT_SCRIPT = [
  { role: "user", text: "Ada menu vegetarian ga?" },
  {
    role: "kun",
    text: "Tentu! Kami punya Pecel Sayur (Rp 25k) dan Gado-gado Spesial (Rp 22k) — bebas daging ✓",
  },
  { role: "user", text: "Buka sampai jam berapa?" },
  {
    role: "kun",
    text: "Kami buka setiap hari jam 09.00–22.00 WIB, termasuk hari libur nasional 🕘",
  },
] as const;

// Delay between each step in ms
const STEP_DELAYS = {
  userAppear: 600, // pause before user bubble appears
  typingShow: 400, // pause before typing indicator
  typingHide: 1400, // how long typing shows before KUN reply appears
  afterReply: 900, // pause after KUN reply before next user message
  resetPause: 2000, // pause at end before full reset
};

type ChatStep =
  | { type: "user"; text: string }
  | { type: "kun"; text: string }
  | { type: "typing" };

const KunAvatar = () => (
  <Image
    src="/images/kun_logo.png"
    alt="KUN"
    width={20}
    height={20}
    className="object-contain brightness-[.95] flex-shrink-0"
  />
);

const RagPreview = () => {
  const [visibleSteps, setVisibleSteps] = useState<ChatStep[]>([]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [phase, setPhase] = useState<"user" | "typing" | "kun" | "done">(
    "user",
  );

  useEffect(() => {
    // Full sequence: user → typing → kun → user → typing → kun → reset
    const runStep = (): (() => void) => {
      const current = CHAT_SCRIPT[scriptIndex];

      if (!current) {
        return () => {};
      }

      if (phase === "user") {
        const t = setTimeout(() => {
          setVisibleSteps((prev) => [
            ...prev,
            { type: "user", text: current.text },
          ]);
          setPhase("typing");
        }, STEP_DELAYS.userAppear);

        return () => clearTimeout(t);
      }

      if (phase === "typing") {
        const t = setTimeout(() => {
          setVisibleSteps((prev) => [...prev, { type: "typing" }]);
          setPhase("kun");
        }, STEP_DELAYS.typingShow);

        return () => clearTimeout(t);
      }

      if (phase === "kun") {
        const t = setTimeout(() => {
          setVisibleSteps((prev) => {
            const withoutTyping = prev.filter((s) => s.type !== "typing");

            const kunMsg = CHAT_SCRIPT[scriptIndex + 1];

            if (!kunMsg || kunMsg.role !== "kun") {
              return withoutTyping;
            }

            return [...withoutTyping, { type: "kun", text: kunMsg.text }];
          });

          const next = scriptIndex + 2;

          if (next <= CHAT_SCRIPT.length - 2) {
            setTimeout(() => {
              setScriptIndex(next);
              setPhase("user");
            }, STEP_DELAYS.afterReply);
          } else {
            setPhase("done");
          }
        }, STEP_DELAYS.typingHide);

        return () => clearTimeout(t);
      }

      if (phase === "done") {
        const t = setTimeout(() => {
          setVisibleSteps([]);
          setScriptIndex(0);
          setPhase("user");
        }, STEP_DELAYS.resetPause);

        return () => clearTimeout(t);
      }

      return () => {};
    };

    const cleanup = runStep();
    return cleanup;
  }, [scriptIndex, phase]);

  return (
    <div
      className="bg-[#1e1e1e] border border-[#333] rounded-xl 
      p-4 mb-0 h-[265px] md:h-[220px] lg:h-[240px] max-lg:mb-6 flex flex-col"
    >
      {/* Header */}
      <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#555] mb-3 flex-shrink-0">
        💬 Live Chat — KUN AI
      </div>

      {/* Chat area */}
      <div className="flex flex-col gap-2 flex-1">
        <AnimatePresence mode="popLayout">
          {visibleSteps.map((step, i) => {
            if (step.type === "user") {
              return (
                <motion.div
                  key={`user-${i}`}
                  variants={chatBubbleIn}
                  initial="hidden"
                  animate="visible"
                  className="flex justify-end"
                >
                  <div
                    className="bg-(--color-brand) text-white text-[11.5px] 
                    sm:text-[12.5px] lg:text-[11.5px] px-3 py-2 rounded-xl 
                    rounded-br-sm max-w-[80%] leading-snug"
                  >
                    {step.text}
                  </div>
                </motion.div>
              );
            }

            if (step.type === "kun") {
              return (
                <motion.div
                  key={`kun-${i}`}
                  variants={chatBubbleIn}
                  initial="hidden"
                  animate="visible"
                  className="flex justify-start items-end gap-1.5"
                >
                  <KunAvatar />
                  <div
                    className="bg-[#2a2a2a] text-[#ddd] text-[11.5px] 
                    sm:text-[12.5px] lg:text-[11.5px] px-4 py-2 
                    rounded-xl rounded-bl-sm max-w-[85%] leading-snug"
                  >
                    {step.text}
                  </div>
                </motion.div>
              );
            }

            if (step.type === "typing") {
              return (
                <motion.div
                  key="typing"
                  variants={chatBubbleIn}
                  initial="hidden"
                  animate="visible"
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    transition: { duration: 0.15 },
                  }}
                  className="flex items-end gap-1.5"
                >
                  <KunAvatar />
                  <div className="flex gap-1 px-3 py-2 bg-[#2a2a2a] rounded-xl rounded-bl-sm w-fit">
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        className="w-1.5 h-1.5 rounded-full bg-[#666] animate-bounce"
                        style={{
                          animationDelay: `${j * 0.2}s`,
                          animationDuration: "1.2s",
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            }

            return null;
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RagPreview;
