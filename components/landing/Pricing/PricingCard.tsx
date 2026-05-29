import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { landingStaggerItem } from "@/lib/animations";
import { PRICING_PLANS } from "@/lib/landing-constants";
import { formatRupiah } from "@/helpers/format";
import { PLAN_PRICE, PLAN_FIRST_TIME_PRICE } from "@/types/billing";
import type { PlanName } from "@/types/billing";

interface PricingCardProps {
  plan: PlanName;
  currentPlan: PlanName | null;
  hasUsedFirstPurchase: boolean;
}

const PricingCard = ({
  plan,
  currentPlan,
  hasUsedFirstPurchase,
}: PricingCardProps) => {
  const config = PRICING_PLANS[plan];
  const regularPrice = PLAN_PRICE[plan];

  // Show first-time price if signed-in user hasn't made a purchase yet
  const isFirstTimeEligible = plan !== "free" && !hasUsedFirstPurchase;
  const displayPrice = isFirstTimeEligible
    ? PLAN_FIRST_TIME_PRICE[plan as "starter" | "pro"]
    : regularPrice;

  const isFeatured = plan === "starter";
  const isCurrent = currentPlan === plan;
  const isSignedIn = currentPlan !== null;

  // CTA label — mirrors dashboard PlanCard logic
  let ctaLabel = "Mulai Sekarang";
  if (isSignedIn && isCurrent) ctaLabel = "Plan Aktif";
  if (isSignedIn && !isCurrent) ctaLabel = "Pilih Plan Ini";

  // CTA href — signed out goes to sign-up, signed in goes to billing
  const ctaHref = isSignedIn ? "/dashboard/billing" : "/sign-up";

  // Disabled if current active plan
  const isDisabled = isSignedIn && isCurrent;

  return (
    <motion.div
      variants={landingStaggerItem}
      className={cn(
        "relative rounded-3xl p-8 border transition-all duration-300 hover:-translate-y-1 flex flex-col",
        isFeatured
          ? "border-(--color-brand) shadow-[0_8px_40px_rgba(6,148,148,0.15)] bg-gradient-to-b from-[#f0fcfc] to-white"
          : "border-(--color-border) bg-white hover:shadow-[var(--shadow-lg)]",
      )}
    >
      {/* "Paling Populer" badge — Starter only */}
      {isFeatured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-(--color-text-900) text-white text-[11px] font-bold tracking-[0.06em] uppercase px-4 py-1.5 rounded-full whitespace-nowrap">
          Paling Populer
        </div>
      )}

      {/* Plan icon + name + active badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{config.icon}</span>
        <span className="text-[14px] font-bold text-(--color-brand) tracking-[0.04em] uppercase">
          {config.label}
        </span>
        {/* Active badge — only shown when this is the current plan */}
        {isCurrent && (
          <span className="ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-(--color-brand-light) text-(--color-brand) border border-(--color-brand-mid)">
            Aktif
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-[13px] text-(--color-text-500) leading-snug mb-6">
        {config.desc}
      </p>

      {/* Price */}
      {isFirstTimeEligible && (
        <div className="text-[16px] text-(--color-text-400) line-through leading-none mb-1">
          {formatRupiah(regularPrice)}
        </div>
      )}
      <div className="text-[44px] font-extrabold tracking-[-0.05em] text-(--color-text-900) leading-none mb-1">
        {formatRupiah(displayPrice)}
      </div>
      <div className="text-[13px] text-(--color-text-500) mb-4">
        {regularPrice > 0 ? "per bulan" : "selamanya gratis"}
      </div>
      {isFirstTimeEligible && (
        <div className="mb-3">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-(--color-brand-light) text-(--color-brand) border border-(--color-brand-mid)">
            🎉 Harga perdana — hemat {formatRupiah(regularPrice - displayPrice)}
          </span>
        </div>
      )}

      {/* CTA */}
      {isDisabled ? (
        // Current plan — not a link, just a disabled button
        <div
          className={cn(
            "block w-full py-3.5 rounded-full text-[14px] font-bold text-center mb-6 opacity-60 cursor-not-allowed",
            isFeatured
              ? "bg-(--color-brand) text-white"
              : "bg-(--color-text-900) text-white",
          )}
        >
          {ctaLabel}
        </div>
      ) : (
        <Link
          href={ctaHref}
          className={cn(
            "block w-full py-3.5 rounded-full text-[14px] font-bold text-center transition-all duration-200 mb-6 hover:-translate-y-0.5",
            isFeatured
              ? "bg-(--color-brand) text-white hover:bg-(--color-brand-dark) shadow-[0_6px_20px_rgba(6,148,148,0.3)]"
              : "bg-(--color-text-900) text-white hover:bg-(--color-text-700)",
          )}
        >
          {ctaLabel}
        </Link>
      )}

      {/* Divider */}
      <div className="border-t border-(--color-border) mb-5" />

      {/* Feature list — available */}
      <ul className="space-y-2 flex-1">
        {config.features.map((feat) => (
          <li
            key={feat}
            className="flex items-center gap-2.5 text-[13.5px] text-(--color-text-700)"
          >
            <span className="text-(--color-brand) font-bold flex-shrink-0">
              ✓
            </span>
            {feat}
          </li>
        ))}
        {/* Unavailable features */}
        {config.unavailable.map((feat) => (
          <li
            key={feat}
            className="flex items-center gap-2.5 text-[13.5px] text-(--color-text-500) opacity-60"
          >
            <span className="flex-shrink-0">—</span>
            {feat}
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

export default PricingCard;
