import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { LandingPage } from "@/components/landing";
import { getActiveOrgCount } from "@/lib/db/queries/dashboard";
import { getBillingData } from "@/lib/db/queries/billing";
import type { PlanName } from "@/types/billing";

export const metadata: Metadata = {
  title: "AI Customer Service untuk Bisnis Indonesia",
  description:
    "Kenalkan KUN — AI asisten virtual dari Kundesk. Upload dokumen bisnis kamu, dan KUN siap menjawab pelanggan 24/7, akurat, dalam Bahasa Indonesia.",
  openGraph: {
    title: "Kundesk — AI Customer Service untuk Bisnis Indonesia",
    description:
      "Kenalkan KUN — AI asisten virtual dari Kundesk. Upload dokumen bisnis kamu, dan KUN siap menjawab pelanggan 24/7, akurat, dalam Bahasa Indonesia.",
    type: "website",
  },
  twitter: {
    title: "Kundesk — AI Customer Service untuk Bisnis Indonesia",
    description:
      "Kenalkan KUN — AI asisten virtual dari Kundesk yang menjawab pelanggan bisnis kamu 24/7. Tanpa coding.",
  },
};

export default async function MarketingPage() {
  let activeOrgCount = 0;
  try {
    activeOrgCount = await getActiveOrgCount();
  } catch (err) {
    console.error("[marketing/page] Failed to fetch org count:", err);
  }

  // Optionally fetch current plan — only if visitor is a signed-in org member
  let currentPlan: PlanName | null = null;
  let hasUsedFirstPurchase = false;
  try {
    const { orgId } = await auth();
    if (orgId) {
      try {
        const billing = await getBillingData(orgId);
        currentPlan = billing.currentPlan;
        hasUsedFirstPurchase = billing.hasUsedFirstPurchase;
      } catch (err) {
        // Billing fetch failed — treat as ineligible to avoid showing
        // a discount the org may no longer qualify for
        console.error("[marketing/page] Failed to fetch billing data:", err);
        currentPlan = "free"; // authenticated but unknown plan — show logged-in CTAs
        hasUsedFirstPurchase = true; // conservative — don't advertise discount
      }
    }
  } catch (err) {
    console.error("[marketing/page] Failed to fetch auth:", err);
  }

  // JSON-LD structured data — helps Google understand the business
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Kundesk",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://kundesk.vercel.app",
    description:
      "Platform AI customer service untuk bisnis Indonesia. Ditenagai oleh KUN — AI asisten virtual yang menjawab pelanggan 24/7 berdasarkan dokumen bisnis kamu.",
    inLanguage: "id",
    // KUN as a named AI assistant — helps search engines understand the product
    featureList: [
      "KUN AI asisten virtual",
      "RAG pipeline berbasis dokumen bisnis",
      "QR Code customer service",
      "Embed widget untuk website",
      "Bahasa Indonesia native",
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "IDR",
      lowPrice: "0",
      highPrice: "399000",
      offerCount: "3",
    },
    creator: {
      "@type": "Organization",
      name: "Kun Borneo",
      url: "https://kundesk.vercel.app",
    },
  };

  return (
    <>
      {/* JSON-LD — injected into <head> by Next.js */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage
        activeOrgCount={activeOrgCount}
        currentPlan={currentPlan}
        hasUsedFirstPurchase={hasUsedFirstPurchase}
      />
    </>
  );
}
