"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import type { PlanName } from "@/types/billing";

// Below-the-fold sections — dynamically imported so hero loads instantly
const TrustStrip = dynamic(() => import("@/components/landing/TrustStrip"));
const FeaturesSection = dynamic(
  () => import("@/components/landing/FeaturesSection"),
);
const HowItWorksSection = dynamic(
  () => import("@/components/landing/HowItWorksSection"),
);
const TestimonialsSection = dynamic(
  () => import("@/components/landing/TestimonialsSection"),
);
const PricingSection = dynamic(
  () => import("@/components/landing/PricingSection"),
);
const FaqSection = dynamic(() => import("@/components/landing/FaqSection"));
const CtaBanner = dynamic(() => import("@/components/landing/CtaBanner"));
const FooterSection = dynamic(
  () => import("@/components/landing/FooterSection"),
);

interface LandingPageProps {
  activeOrgCount: number;
  currentPlan: PlanName | null; // null = not signed in
}

const LandingPage = ({ activeOrgCount, currentPlan }: LandingPageProps) => {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      <HeroSection activeOrgCount={activeOrgCount} />
      <TrustStrip />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection currentPlan={currentPlan} />
      <FaqSection />
      <CtaBanner />
      <FooterSection />
    </div>
  );
};

export default LandingPage;
