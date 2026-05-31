"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaqCard } from "@/components/landing/faq";
import { scrollReveal, landingStagger } from "@/lib/animations";
import { FAQ_ITEMS } from "@/lib/constants/landing-constants";

const FaqSection = () => {
  // Track which FAQ item is open — null means all closed
  const [openId, setOpenId] = useState<number | null>(1);

  const toggle = (id: number) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq" className="py-24 px-6 lg:px-16 bg-(--color-bg-input)">
      {/* Section header */}
      <motion.div
        variants={scrollReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="text-center mb-14 max-w-2xl mx-auto"
      >
        <div className="text-[12px] font-bold tracking-[0.1em] uppercase text-(--color-brand) mb-4">
          // FAQ
        </div>
        <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-[1.1] mb-4">
          Pertanyaan yang{" "}
          <em
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "var(--color-brand)",
              fontWeight: 400,
            }}
          >
            sering ditanya
          </em>
        </h2>
        <p className="text-[16px] text-(--color-text-500) leading-relaxed">
          Jawaban jelas, tanpa basa-basi.
        </p>
      </motion.div>

      {/* FAQ accordion */}
      <motion.div
        variants={landingStagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="max-w-[720px] mx-auto flex flex-col gap-2.5"
      >
        {FAQ_ITEMS.map((item) => {
          const isOpen = openId === item.id;
          return (
            <FaqCard
              key={item.id}
              id={item.id}
              answer={item.answer}
              question={item.question}
              isOpen={isOpen}
              toggle={() => toggle(item.id)}
              // Privacy link suffix — only for the data safety FAQ
              answerSuffix={
                item.hasPrivacyLink ? (
                  <>
                    Lengkapnya kunjungi laman{" "}
                    <Link
                      href="/privacy"
                      className="text-(--color-text-400) hover:text-(--color-brand) underline underline-offset-2 transition-colors duration-200"
                    >
                      Kebijakan Privasi.
                    </Link>
                  </>
                ) : undefined
              }
            />
          );
        })}
      </motion.div>
    </section>
  );
};

export default FaqSection;
