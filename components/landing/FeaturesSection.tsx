"use client";

import { motion } from "framer-motion";
import {
  RagPreview,
  AnalyticsPreview,
  TenantPreview,
  SecurityPreview,
} from "@/components/landing/features";
import {
  scrollReveal,
  landingStagger,
  landingStaggerItem,
} from "@/lib/animations";
import { FEATURES } from "@/lib/constants/landing-constants";

// Map preview type from constants to component
const PREVIEW_MAP = {
  rag: RagPreview,
  analytics: AnalyticsPreview,
  tenant: TenantPreview,
  security: SecurityPreview,
} as const;

const FeaturesSection = () => {
  return (
    <section
      id="features"
      className="py-24 px-6 lg:px-16"
      style={{ background: "#111" }}
    >
      {/* Section header */}
      <motion.div
        variants={scrollReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="text-center mb-14 max-w-2xl mx-auto"
      >
        <div className="text-[12px] font-bold tracking-[0.1em] uppercase text-(--color-brand) mb-4">
          // Fitur
        </div>
        <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.04em] text-white leading-[1.1] mb-4">
          Fitur canggih untuk CS yang{" "}
          <em
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "var(--color-brand)",
              fontWeight: 400,
            }}
          >
            lebih pintar
          </em>
        </h2>
        <p className="text-[16px] text-[#888] leading-relaxed">
          Semua yang KUN butuhkan untuk melayani pelanggan bisnis kamu — dari AI
          yang tahu dokumen bisnismu sampai analytics real-time.
        </p>
      </motion.div>

      {/* 2×2 Feature cards grid */}
      <motion.div
        variants={landingStagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[1100px] mx-auto"
      >
        {FEATURES.map((feat) => {
          const Preview = PREVIEW_MAP[feat.preview];
          return (
            <motion.div
              key={feat.id}
              variants={landingStaggerItem}
              className="group relative bg-[#181818] border border-[#2a2a2a] rounded-2xl p-8 transition-all duration-300 hover:border-[rgba(6,148,148,0.35)] hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Top shimmer line on hover */}
              <div
                className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(6,148,148,0.5)] 
                to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />

              {/* Mini UI preview */}
              <Preview />

              {/* Feature text */}
              <div className="text-[18px] font-bold tracking-[-0.02em] text-(--color-brand) mb-2">
                {feat.name}
              </div>
              <p className="text-[14px] text-[#888] leading-[1.65]">
                {feat.desc}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
};

export default FeaturesSection;
