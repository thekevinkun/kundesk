// Component tests for PricingCard
// Tests the auth-aware CTA logic — label, href, disabled state, active badge
// Framer Motion and Next/Link are mocked — we're testing logic, not animations

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PricingCard from "./PricingCard";

// ── Mock framer-motion ──
// motion.div in jsdom has no animation context — renders as plain div
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...rest}>
        {children}
      </div>
    ),
  },
}));

// ── Mock next/link ──
// Next.js Link requires router context — render as plain <a> in tests
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// ── Mock animations ──
// Animation variants are irrelevant to the logic we're testing
vi.mock("@/lib/animations", () => ({
  landingStaggerItem: {},
}));

describe("PricingCard", () => {
  // ── Not signed in (currentPlan = null) ──

  describe("when not signed in", () => {
    it("shows 'Mulai Sekarang' CTA for free plan", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Mulai Sekarang")).toBeInTheDocument();
    });

    it("shows 'Mulai Sekarang' CTA for starter plan", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Mulai Sekarang")).toBeInTheDocument();
    });

    it("shows 'Mulai Sekarang' CTA for pro plan", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Mulai Sekarang")).toBeInTheDocument();
    });

    it("CTA links to /sign-up when not signed in", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      const link = screen.getByRole("link", { name: "Mulai Sekarang" });
      expect(link).toHaveAttribute("href", "/sign-up");
    });

    it("does not show 'Aktif' badge when not signed in", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.queryByText("Aktif")).not.toBeInTheDocument();
    });

    it("CTA is a link — not disabled — when not signed in", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      // Should be a link, not a div with cursor-not-allowed
      const link = screen.getByRole("link", { name: "Mulai Sekarang" });
      expect(link).toBeInTheDocument();
    });
  });

  // ── Signed in, viewing current plan ──

  describe("when signed in and viewing current plan", () => {
    it("shows 'Plan Aktif' CTA when free is current plan", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan="free"
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Plan Aktif")).toBeInTheDocument();
    });

    it("shows 'Plan Aktif' CTA when starter is current plan", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan="starter"
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Plan Aktif")).toBeInTheDocument();
    });

    it("shows 'Plan Aktif' CTA when pro is current plan", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan="pro"
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Plan Aktif")).toBeInTheDocument();
    });

    it("shows 'Aktif' badge on current plan", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan="starter"
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Aktif")).toBeInTheDocument();
    });

    it("renders CTA as disabled div — not a link — for current plan", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan="starter"
          hasUsedFirstPurchase={false}
        />,
      );
      // Should NOT find a link with this label
      expect(
        screen.queryByRole("link", { name: "Plan Aktif" }),
      ).not.toBeInTheDocument();
      // Should find the text in a non-link element
      expect(screen.getByText("Plan Aktif")).toBeInTheDocument();
    });

    it("disabled CTA has cursor-not-allowed class", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan="starter"
          hasUsedFirstPurchase={false}
        />,
      );
      const cta = screen.getByText("Plan Aktif");
      expect(cta).toHaveClass("cursor-not-allowed");
    });
  });

  // ── Signed in, viewing non-current plan ──

  describe("when signed in but viewing a different plan", () => {
    it("shows 'Pilih Plan Ini' when signed in on free but viewing starter", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan="free"
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Pilih Plan Ini")).toBeInTheDocument();
    });

    it("shows 'Pilih Plan Ini' when signed in on starter but viewing pro", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan="starter"
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Pilih Plan Ini")).toBeInTheDocument();
    });

    it("CTA links to /dashboard/billing when signed in", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan="starter"
          hasUsedFirstPurchase={false}
        />,
      );
      const link = screen.getByRole("link", { name: "Pilih Plan Ini" });
      expect(link).toHaveAttribute("href", "/dashboard/billing");
    });

    it("does not show 'Aktif' badge on non-current plan", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan="starter"
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.queryByText("Aktif")).not.toBeInTheDocument();
    });

    it("CTA is a link — not disabled — for non-current plans", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan="free"
          hasUsedFirstPurchase={false}
        />,
      );
      const link = screen.getByRole("link", { name: "Pilih Plan Ini" });
      expect(link).toBeInTheDocument();
    });
  });

  // ── Starter featured badge ──

  describe("featured card (starter)", () => {
    it("shows 'Paling Populer' badge on starter plan", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Paling Populer")).toBeInTheDocument();
    });

    it("does not show 'Paling Populer' badge on free plan", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.queryByText("Paling Populer")).not.toBeInTheDocument();
    });

    it("does not show 'Paling Populer' badge on pro plan", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.queryByText("Paling Populer")).not.toBeInTheDocument();
    });
  });

  // ── Plan content ──

  describe("plan content", () => {
    it("shows correct plan label for free", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Free")).toBeInTheDocument();
    });

    it("shows correct plan label for starter", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Starter")).toBeInTheDocument();
    });

    it("shows correct plan label for pro", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });

    it("shows 'Gratis' price for free plan", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Gratis")).toBeInTheDocument();
    });

    it("shows 'selamanya gratis' for free plan", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("selamanya gratis")).toBeInTheDocument();
    });

    it("shows 'per bulan' for paid plans", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("per bulan")).toBeInTheDocument();
    });

    it("shows a feature from the free plan features list", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("100 pesan / bulan")).toBeInTheDocument();
    });

    it("shows a feature from the pro plan features list", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText("Dokumen unlimited")).toBeInTheDocument();
    });
  });

  // ── First-time discount (hasUsedFirstPurchase) ──

  describe("first-time discount pricing", () => {
    it("shows discounted price for starter when eligible", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      // First-time price is Rp 99.000
      expect(screen.getByText("Rp 99.000")).toBeInTheDocument();
    });

    it("shows discounted price for pro when eligible", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      // First-time price is Rp 299.000
      expect(screen.getByText("Rp 299.000")).toBeInTheDocument();
    });

    it("shows strikethrough regular price for starter when eligible", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      // Regular price Rp 149.000 shown struck through
      expect(screen.getByText("Rp 149.000")).toBeInTheDocument();
    });

    it("shows strikethrough regular price for pro when eligible", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      // Regular price Rp 399.000 shown struck through
      expect(screen.getByText("Rp 399.000")).toBeInTheDocument();
    });

    it("shows 'Harga perdana' badge when eligible", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.getByText(/Harga perdana/)).toBeInTheDocument();
    });

    it("shows regular price for starter when not eligible", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={true}
        />,
      );
      expect(screen.getByText("Rp 149.000")).toBeInTheDocument();
      // Discounted price should NOT appear
      expect(screen.queryByText("Rp 99.000")).not.toBeInTheDocument();
    });

    it("shows regular price for pro when not eligible", () => {
      render(
        <PricingCard
          plan="pro"
          currentPlan={null}
          hasUsedFirstPurchase={true}
        />,
      );
      expect(screen.getByText("Rp 399.000")).toBeInTheDocument();
      expect(screen.queryByText("Rp 299.000")).not.toBeInTheDocument();
    });

    it("does not show 'Harga perdana' badge when not eligible", () => {
      render(
        <PricingCard
          plan="starter"
          currentPlan={null}
          hasUsedFirstPurchase={true}
        />,
      );
      expect(screen.queryByText(/Harga perdana/)).not.toBeInTheDocument();
    });

    it("free plan never shows discount regardless of eligibility", () => {
      render(
        <PricingCard
          plan="free"
          currentPlan={null}
          hasUsedFirstPurchase={false}
        />,
      );
      expect(screen.queryByText(/Harga perdana/)).not.toBeInTheDocument();
      expect(screen.getByText("Gratis")).toBeInTheDocument();
    });
  });
});
