"use client";

import { motion } from "framer-motion";
import PricingCard from "./Pricing/PricingCard";
import { scrollReveal, landingStagger } from "@/lib/animations";
import type { PlanName } from "@/types/billing";

interface PricingSectionProps {
  currentPlan: PlanName | null;
}

const PricingSection = ({ currentPlan }: PricingSectionProps) => {
  return (
    <section id="pricing" className="py-24 px-6 lg:px-16 bg-white">
      {/* Section header */}
      <motion.div
        variants={scrollReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="text-center mb-14 max-w-2xl mx-auto"
      >
        <div className="text-[12px] font-bold tracking-[0.1em] uppercase text-(--color-brand) mb-4">
          // Harga
        </div>
        <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-[1.1] mb-4">
          Harga yang{" "}
          <em
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "var(--color-brand)",
              fontWeight: 400,
            }}
          >
            transparan
          </em>
        </h2>
        <p className="text-[16px] text-(--color-text-500) leading-relaxed">
          Mulai gratis, upgrade kapan siap. Tidak ada biaya tersembunyi, tidak
          ada kejutan di tagihan.
        </p>
      </motion.div>

      {/* Pricing cards */}
      <motion.div
        variants={landingStagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[1000px] mx-auto items-start"
      >
        {(["free", "starter", "pro"] as PlanName[]).map((plan) => (
          <PricingCard key={plan} plan={plan} currentPlan={currentPlan} />
        ))}
      </motion.div>
    </section>
  );
};

export default PricingSection;
