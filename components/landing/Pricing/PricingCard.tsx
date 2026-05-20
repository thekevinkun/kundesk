import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { landingStaggerItem } from "@/lib/animations";
import type { PricingPlansItems } from "@/lib/landing-constants";

const PricingCard = ({
  id,
  name,
  desc,
  price,
  period,
  cta,
  ctaVariant,
  featured,
  features,
}: PricingPlansItems) => {
  return (
    <motion.div
      id={id}
      variants={landingStaggerItem}
      className={cn(
        "relative rounded-3xl p-8 border transition-all duration-300 hover:-translate-y-1",
        featured
          ? "border-(--color-brand) shadow-[0_8px_40px_rgba(6,148,148,0.15)] bg-gradient-to-b from-[#f0fcfc] to-white"
          : "border-(--color-border) bg-white hover:shadow-[var(--shadow-lg)]",
      )}
    >
      {/* Popular badge */}
      {featured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-(--color-text-900) text-white text-[11px] font-bold tracking-[0.06em] uppercase px-4 py-1.5 rounded-full whitespace-nowrap">
          Paling Populer
        </div>
      )}

      {/* Plan name + desc */}
      <div className="text-[14px] font-bold text-(--color-brand) tracking-[0.04em] uppercase mb-2">
        {name}
      </div>
      <p className="text-[13px] text-(--color-text-400) leading-snug mb-6">
        {desc}
      </p>

      {/* Price */}
      <div className="text-[44px] font-extrabold tracking-[-0.05em] text-(--color-text-900) leading-none mb-1">
        {price}
      </div>
      <div className="text-[13px] text-(--color-text-400) mb-7">{period}</div>

      {/* CTA */}
      <Link
        href="/sign-up"
        className={cn(
          "block w-full py-3.5 rounded-full text-[14px] font-bold text-center transition-all duration-200 mb-6",
          ctaVariant === "brand"
            ? "bg-(--color-brand) text-white hover:bg-(--color-brand-dark) shadow-[0_6px_20px_rgba(6,148,148,0.3)] hover:-translate-y-0.5"
            : "bg-(--color-text-900) text-white hover:bg-(--color-text-700) hover:-translate-y-0.5",
        )}
      >
        {cta}
      </Link>

      {/* Feature list */}
      <ul className="space-y-0">
        {features.map((feat) => (
          <li
            key={feat.text}
            className={cn(
              "flex items-center gap-2.5 py-2.5 border-t border-(--color-border-sm) text-[13.5px]",
              feat.included
                ? "text-(--color-text-700)"
                : "text-(--color-text-400) opacity-50",
            )}
          >
            <span
              className="text-[14px] flex-shrink-0"
              style={{
                color: feat.included
                  ? "var(--color-brand)"
                  : "var(--color-text-400)",
              }}
            >
              {feat.included ? "✓" : "—"}
            </span>
            {feat.text}
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

export default PricingCard;
