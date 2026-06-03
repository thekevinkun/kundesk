"use client";

import { useMemo } from "react";
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

const PREVIEW_MAP = {
  rag: RagPreview,
  analytics: AnalyticsPreview,
  tenant: TenantPreview,
  security: SecurityPreview,
} as const;

const CARD_BASE_CLASSES = `
  bg-[#181818] border border-[#2a2a2a] rounded-2xl 
  transition-all duration-300 hover:border-[rgba(6,148,148,0.35)] 
  hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] 
  overflow-hidden
`.trim();

// Wide features — alternating text/preview layout like monday.com
const WideFeatureRow = ({
  feat,
  index,
}: {
  feat: (typeof FEATURES)[number];
  index: number;
}) => {
  const Preview = PREVIEW_MAP[feat.preview];
  // Even index: text left, preview right — odd: preview left, text right
  const isReversed = index % 2 !== 0;

  return (
    <motion.div
      variants={landingStaggerItem}
      className={`hidden lg:flex 
      ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-10 items-start`}
    >
      {/* Top shimmer line on hover */}
      {/* <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(6,148,148,0.5)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" /> */}

      {/* Text side */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold tracking-[0.08em] uppercase text-(--color-brand) mb-4">
          {feat.icon} {feat.category}
        </div>
        <h3 className="text-[clamp(22px,3vw,32px)] font-extrabold tracking-[-0.03em] text-white leading-[1.15] mb-4">
          {feat.name}
        </h3>
        <p className="text-[15px] text-[#888] leading-relaxed">{feat.desc}</p>
      </div>

      {/* Preview side */}
      <div className="w-full lg:w-[520px] flex-shrink-0">
        <div className={`group relative ${CARD_BASE_CLASSES} p-8`}>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(6,148,148,0.5)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Preview />
        </div>
      </div>
    </motion.div>
  );
};

// Card features — original compact card style, unchanged
const CardFeature = ({ feat }: { feat: (typeof FEATURES)[number] }) => {
  const Preview = PREVIEW_MAP[feat.preview];

  return (
    <motion.div
      variants={landingStaggerItem}
      className={`group relative flex flex-col ${CARD_BASE_CLASSES} p-8`}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(6,148,148,0.5)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex-1">
        <Preview />
      </div>

      <div className="text-[18px] font-bold tracking-[-0.02em] text-(--color-brand) mb-2">
        {feat.name}
      </div>

      <p className="text-[14px] text-[#888] leading-[1.65]">{feat.desc}</p>
    </motion.div>
  );
};

const FeaturesSection = () => {
  const wideFeatures = useMemo(
    () => FEATURES.filter((f) => f.layout === "wide"),
    [],
  );

  const cardFeatures = useMemo(
    () => FEATURES.filter((f) => f.layout === "card"),
    [],
  );

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
        className="text-center mb-18 max-w-2xl mx-auto"
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

      <motion.div
        variants={landingStagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="max-w-[1200px] mx-auto flex flex-col gap-10 lg:gap-26"
      >
        {/* Wide alternating rows — RAG and Analytics */}

        {wideFeatures.map((feat, i) => (
          <WideFeatureRow key={feat.id} feat={feat} index={i} />
        ))}

        <div className="lg:hidden grid gap-10">
          {wideFeatures.map((feat) => (
            <CardFeature key={feat.id} feat={feat} />
          ))}
        </div>

        {/* Card grid — Tenant and Security */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-5">
          {cardFeatures.map((feat) => (
            <CardFeature key={feat.id} feat={feat} />
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default FeaturesSection;
