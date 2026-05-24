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
      render(<PricingCard plan="free" currentPlan={null} />);
      expect(screen.getByText("Mulai Sekarang")).toBeInTheDocument();
    });

    it("shows 'Mulai Sekarang' CTA for starter plan", () => {
      render(<PricingCard plan="starter" currentPlan={null} />);
      expect(screen.getByText("Mulai Sekarang")).toBeInTheDocument();
    });

    it("shows 'Mulai Sekarang' CTA for pro plan", () => {
      render(<PricingCard plan="pro" currentPlan={null} />);
      expect(screen.getByText("Mulai Sekarang")).toBeInTheDocument();
    });

    it("CTA links to /sign-up when not signed in", () => {
      render(<PricingCard plan="starter" currentPlan={null} />);
      const link = screen.getByRole("link", { name: "Mulai Sekarang" });
      expect(link).toHaveAttribute("href", "/sign-up");
    });

    it("does not show 'Aktif' badge when not signed in", () => {
      render(<PricingCard plan="starter" currentPlan={null} />);
      expect(screen.queryByText("Aktif")).not.toBeInTheDocument();
    });

    it("CTA is a link — not disabled — when not signed in", () => {
      render(<PricingCard plan="free" currentPlan={null} />);
      // Should be a link, not a div with cursor-not-allowed
      const link = screen.getByRole("link", { name: "Mulai Sekarang" });
      expect(link).toBeInTheDocument();
    });
  });

  // ── Signed in, viewing current plan ──

  describe("when signed in and viewing current plan", () => {
    it("shows 'Plan Aktif' CTA when free is current plan", () => {
      render(<PricingCard plan="free" currentPlan="free" />);
      expect(screen.getByText("Plan Aktif")).toBeInTheDocument();
    });

    it("shows 'Plan Aktif' CTA when starter is current plan", () => {
      render(<PricingCard plan="starter" currentPlan="starter" />);
      expect(screen.getByText("Plan Aktif")).toBeInTheDocument();
    });

    it("shows 'Plan Aktif' CTA when pro is current plan", () => {
      render(<PricingCard plan="pro" currentPlan="pro" />);
      expect(screen.getByText("Plan Aktif")).toBeInTheDocument();
    });

    it("shows 'Aktif' badge on current plan", () => {
      render(<PricingCard plan="starter" currentPlan="starter" />);
      expect(screen.getByText("Aktif")).toBeInTheDocument();
    });

    it("renders CTA as disabled div — not a link — for current plan", () => {
      render(<PricingCard plan="starter" currentPlan="starter" />);
      // Should NOT find a link with this label
      expect(
        screen.queryByRole("link", { name: "Plan Aktif" }),
      ).not.toBeInTheDocument();
      // Should find the text in a non-link element
      expect(screen.getByText("Plan Aktif")).toBeInTheDocument();
    });

    it("disabled CTA has cursor-not-allowed class", () => {
      render(<PricingCard plan="starter" currentPlan="starter" />);
      const cta = screen.getByText("Plan Aktif");
      expect(cta).toHaveClass("cursor-not-allowed");
    });
  });

  // ── Signed in, viewing non-current plan ──

  describe("when signed in but viewing a different plan", () => {
    it("shows 'Pilih Plan Ini' when signed in on free but viewing starter", () => {
      render(<PricingCard plan="starter" currentPlan="free" />);
      expect(screen.getByText("Pilih Plan Ini")).toBeInTheDocument();
    });

    it("shows 'Pilih Plan Ini' when signed in on starter but viewing pro", () => {
      render(<PricingCard plan="pro" currentPlan="starter" />);
      expect(screen.getByText("Pilih Plan Ini")).toBeInTheDocument();
    });

    it("CTA links to /dashboard/billing when signed in", () => {
      render(<PricingCard plan="pro" currentPlan="starter" />);
      const link = screen.getByRole("link", { name: "Pilih Plan Ini" });
      expect(link).toHaveAttribute("href", "/dashboard/billing");
    });

    it("does not show 'Aktif' badge on non-current plan", () => {
      render(<PricingCard plan="pro" currentPlan="starter" />);
      expect(screen.queryByText("Aktif")).not.toBeInTheDocument();
    });

    it("CTA is a link — not disabled — for non-current plans", () => {
      render(<PricingCard plan="pro" currentPlan="free" />);
      const link = screen.getByRole("link", { name: "Pilih Plan Ini" });
      expect(link).toBeInTheDocument();
    });
  });

  // ── Starter featured badge ──

  describe("featured card (starter)", () => {
    it("shows 'Paling Populer' badge on starter plan", () => {
      render(<PricingCard plan="starter" currentPlan={null} />);
      expect(screen.getByText("Paling Populer")).toBeInTheDocument();
    });

    it("does not show 'Paling Populer' badge on free plan", () => {
      render(<PricingCard plan="free" currentPlan={null} />);
      expect(screen.queryByText("Paling Populer")).not.toBeInTheDocument();
    });

    it("does not show 'Paling Populer' badge on pro plan", () => {
      render(<PricingCard plan="pro" currentPlan={null} />);
      expect(screen.queryByText("Paling Populer")).not.toBeInTheDocument();
    });
  });

  // ── Plan content ──

  describe("plan content", () => {
    it("shows correct plan label for free", () => {
      render(<PricingCard plan="free" currentPlan={null} />);
      expect(screen.getByText("Free")).toBeInTheDocument();
    });

    it("shows correct plan label for starter", () => {
      render(<PricingCard plan="starter" currentPlan={null} />);
      expect(screen.getByText("Starter")).toBeInTheDocument();
    });

    it("shows correct plan label for pro", () => {
      render(<PricingCard plan="pro" currentPlan={null} />);
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });

    it("shows 'Gratis' price for free plan", () => {
      render(<PricingCard plan="free" currentPlan={null} />);
      expect(screen.getByText("Gratis")).toBeInTheDocument();
    });

    it("shows 'selamanya gratis' for free plan", () => {
      render(<PricingCard plan="free" currentPlan={null} />);
      expect(screen.getByText("selamanya gratis")).toBeInTheDocument();
    });

    it("shows 'per bulan' for paid plans", () => {
      render(<PricingCard plan="starter" currentPlan={null} />);
      expect(screen.getByText("per bulan")).toBeInTheDocument();
    });

    it("shows a feature from the free plan features list", () => {
      render(<PricingCard plan="free" currentPlan={null} />);
      expect(screen.getByText("100 pesan / bulan")).toBeInTheDocument();
    });

    it("shows a feature from the pro plan features list", () => {
      render(<PricingCard plan="pro" currentPlan={null} />);
      expect(screen.getByText("Dokumen unlimited")).toBeInTheDocument();
    });
  });
});
