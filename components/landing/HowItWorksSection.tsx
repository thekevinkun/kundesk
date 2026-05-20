"use client";

import { motion } from "framer-motion";
import {
  scrollReveal,
  landingStagger,
  landingStaggerItem,
} from "@/lib/animations";
import { HOW_IT_WORKS_STEPS } from "@/lib/landing-constants";

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 px-6 lg:px-16 bg-white">
      {/* Section header */}
      <motion.div
        variants={scrollReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="text-center mb-16 max-w-2xl mx-auto"
      >
        <div className="text-[12px] font-bold tracking-[0.1em] uppercase text-(--color-brand) mb-4">
          // Cara Kerja
        </div>
        <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-[1.1] mb-4">
          Setup{" "}
          <em
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "var(--color-brand)",
              fontWeight: 400,
            }}
          >
            5 menit
          </em>
          , jalan selamanya
        </h2>
        <p className="text-[16px] text-(--color-text-500) leading-relaxed">
          Tidak perlu developer, tidak perlu coding. Cukup 3 langkah dan chatbot
          kamu langsung aktif 24/7.
        </p>
      </motion.div>

      {/* Steps */}
      <div className="max-w-[1100px] mx-auto relative">
        {/* Connector line — desktop only */}
        <div
          className="hidden lg:block absolute top-[28px] left-[20%] right-[20%] h-px"
          style={{
            background:
              "linear-gradient(90deg, var(--color-brand-mid), var(--color-brand), var(--color-brand-mid))",
          }}
        />

        <motion.div
          variants={landingStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8"
        >
          {HOW_IT_WORKS_STEPS.map(({ step, icon, title, desc }) => (
            <motion.div
              key={step}
              variants={landingStaggerItem}
              className="flex flex-col items-center text-center relative z-10"
            >
              {/* Step circle */}
              <div className="relative mb-6">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[20px] font-extrabold shadow-[0_8px_24px_rgba(6,148,148,0.35)]"
                  style={{ background: "var(--color-brand)" }}
                >
                  {step}
                </div>
                {/* Outer ring */}
                <div className="absolute -inset-1 rounded-full border-2 border-(--color-brand-mid)" />
              </div>

              {/* Icon */}
              <span className="text-[40px] mb-4 block">{icon}</span>

              {/* Text */}
              <h3 className="text-[18px] font-bold tracking-[-0.02em] text-(--color-text-900) mb-3">
                {title}
              </h3>
              <p className="text-[14px] text-(--color-text-500) leading-[1.7] max-w-[280px]">
                {desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
