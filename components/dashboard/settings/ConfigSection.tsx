"use client";

import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { staggerItem } from "@/lib/animations";

interface ConfigSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const ConfigSection = ({
  title,
  description,
  children,
}: ConfigSectionProps) => {
  return (
    <motion.div variants={staggerItem} className="card-base p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-bold text-(--color-text-900) mb-1">
          {title}
        </h2>

        <p className="text-[12.5px] text-(--color-text-400)">{description}</p>
      </div>

      <Separator className="mb-5 bg-(--color-border-sm)" />

      {children}
    </motion.div>
  );
};

export default ConfigSection;
