"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { createPayment } from "@/lib/actions/billing";
import { PLAN_CONFIG } from "@/components/dashboard/billing/constants";
import { formatRupiah } from "@/helpers/format";
import { PLAN_PRICE, PLAN_FIRST_TIME_PRICE } from "@/types/billing";
import type { BillingPageData, PlanName } from "@/types/billing";

interface PlanCardProps {
  plan: PlanName;
  currentPlan: PlanName;
  subscriptionStatus: BillingPageData["subscriptionStatus"];
  hasUsedFirstPurchase: boolean;
  // null = no promo entered, string = code to apply at checkout
  promoCode: string | null;
}

const PlanCard = ({
  plan,
  currentPlan,
  subscriptionStatus,
  hasUsedFirstPurchase,
  promoCode,
}: PlanCardProps) => {
  const config = PLAN_CONFIG[plan];
  const isCurrent = plan === currentPlan;
  const isFeatured = plan === "starter";

  // Free plan has no discount logic
  const regularPrice = PLAN_PRICE[plan];

  // Display price — what the user sees on the card
  // Promo code takes precedence over first-time discount (no stacking)
  // Note: actual promo discount % is unknown client-side — we just show "Kode diterapkan"
  // The real deduction is calculated server-side in createPayment
  const isFirstTimeEligible = plan !== "free" && !hasUsedFirstPurchase;

  const hasPromo = plan !== "free" && !!promoCode;

  const displayPrice = hasPromo
    ? regularPrice // show regular, server will apply promo — we don't know % client-side
    : isFirstTimeEligible
      ? PLAN_FIRST_TIME_PRICE[plan as "starter" | "pro"]
      : regularPrice;

  const showOriginalPrice = !hasPromo && isFirstTimeEligible;

  const [state, formAction, isPending] = useActionState(createPayment, null);

  // Redirect to Midtrans on success, show error toast on failure
  useEffect(() => {
    if (!state) return;
    if (state.success) {
      window.location.href = state.redirectUrl;
    } else {
      toast.error(state.error);
    }
  }, [state]);

  // CTA label — contextual based on current plan + status
  let ctaLabel = "Pilih Plan Ini";
  if (isCurrent && subscriptionStatus === "active") ctaLabel = "Plan Aktif";
  if (plan === "free")
    ctaLabel = isCurrent ? "Plan Aktif" : "Gunakan menu Batalkan Langganan";

  const isDisabled =
    isPending ||
    (isCurrent && subscriptionStatus === "active") ||
    plan === "free"; // Free plan has no payment flow

  return (
    <div
      className={`card-base card-hover p-6 relative flex flex-col ${
        isFeatured
          ? "border-(--color-brand) bg-gradient-to-b from-(--color-brand-light)/40 to-(--color-bg-card)"
          : ""
      }`}
    >
      {/* "Paling Populer" badge — Starter only */}
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="badge-base bg-(--color-text-900) text-white text-[10px] px-3 py-1 rounded-(--radius-full) whitespace-nowrap shadow-sm">
            Paling Populer
          </span>
        </div>
      )}

      {/* Plan header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{config.icon}</span>
          <span className="text-sm font-bold text-(--color-brand) tracking-wide uppercase">
            {config.label}
          </span>
          {/* Active badge — shown inline on current plan card */}
          {isCurrent && subscriptionStatus === "active" && (
            <span className="badge-base badge-success ml-auto">Aktif</span>
          )}
        </div>
        <p className="text-xs text-(--color-text-400) leading-relaxed">
          {config.desc}
        </p>
      </div>

      {/* Price */}
      <div className="mb-5">
        {/* Strikethrough original price — only shown when first-time discount applies */}
        {showOriginalPrice && (
          <div className="text-sm text-(--color-text-400) line-through mb-0.5">
            {formatRupiah(regularPrice)}
          </div>
        )}
        <div className="text-3xl font-extrabold tracking-tight text-(--color-text-900) leading-none mb-1">
          {formatRupiah(displayPrice)}
        </div>
        {regularPrice > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-(--color-text-400)">per bulan</span>
            {/* Promo applied indicator — shown when a code is entered */}
            {hasPromo && (
              <span className="badge-base badge-success text-[10px]">
                🎟 Kode diterapkan
              </span>
            )}
            {/* First-time discount badge */}
            {showOriginalPrice && (
              <span className="badge-base badge-success text-[10px]">
                🎉 Harga perdana
              </span>
            )}
          </div>
        )}
      </div>

      {/* CTA form — hidden inputs pass plan + promo code to Server Action */}
      <form action={formAction} className="mb-5">
        <input type="hidden" name="plan" value={plan} />

        {/* Pass promo code if one is entered — validated server-side */}
        {promoCode && (
          <input type="hidden" name="promoCode" value={promoCode} />
        )}

        <button
          type="submit"
          disabled={isDisabled}
          className={`w-full py-2.5 px-4 rounded-(--radius-full) text-sm font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isFeatured
              ? "bg-(--color-brand) text-white hover:bg-(--color-brand-dark) shadow-md hover:shadow-lg"
              : "bg-(--color-text-900) text-white hover:bg-(--color-text-700)"
          }`}
        >
          {isPending ? "Memproses..." : ctaLabel}
        </button>
      </form>

      <Separator className="mb-4" />

      {/* Feature list */}
      <ul
        className="space-y-2 flex-1"
        aria-label={`Fitur plan ${config.label}`}
      >
        {config.features.map((feat) => (
          <li
            key={feat}
            className="flex items-center gap-2 text-xs text-(--color-text-700)"
          >
            <span
              className="text-(--color-success) font-bold flex-shrink-0"
              aria-hidden="true"
            >
              ✓
            </span>
            {feat}
          </li>
        ))}
        {config.unavailable.map((feat) => (
          <li
            key={feat}
            className="flex items-center gap-2 text-xs text-(--color-text-400) opacity-50"
            aria-label={`${feat} — tidak tersedia`}
          >
            <span className="flex-shrink-0" aria-hidden="true">
              —
            </span>
            {feat}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlanCard;
