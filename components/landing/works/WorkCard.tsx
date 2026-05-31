import { motion } from "framer-motion";
import { landingStaggerItem } from "@/lib/animations";

interface WorkCardProps {
  step: number;
  icon: string;
  title: string;
  desc: string;
}

const WorkCard = ({ step, icon, title, desc }: WorkCardProps) => {
  return (
    <motion.div
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
  );
};

export default WorkCard;
