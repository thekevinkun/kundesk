"use client";

import { motion } from "framer-motion";
import { DemoCard, WorkCard } from "@/components/landing/works";
import { scrollReveal, landingStagger } from "@/lib/animations";
import { HOW_IT_WORKS_STEPS } from "@/lib/constants/landing-constants";

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
          Tidak perlu developer, tidak perlu coding.
          <br />
          Cukup 3 langkah dan KUN langsung aktif 24/7.
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
            <WorkCard
              key={step}
              step={step}
              icon={icon}
              title={title}
              desc={desc}
            />
          ))}
        </motion.div>

        {/* Demo video — shows KUN in action */}
        <DemoCard />
      </div>
    </section>
  );
};

export default HowItWorksSection;
