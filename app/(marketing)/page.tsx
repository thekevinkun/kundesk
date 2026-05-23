import type { Metadata } from "next";
import { getActiveOrgCount } from "@/lib/db/queries/dashboard";
import { LandingPage } from "@/components/landing";

export const metadata: Metadata = {
  title: "AI Customer Service untuk Bisnis Indonesia",
  description:
    "Upload dokumen bisnis kamu — menu, FAQ, harga. Kundesk membangun chatbot AI yang menjawab pelanggan 24/7, akurat, dalam Bahasa Indonesia.",
  openGraph: {
    title: "Kundesk — AI Customer Service untuk Bisnis Indonesia",
    description:
      "Upload dokumen bisnis kamu — menu, FAQ, harga. Kundesk membangun chatbot AI yang menjawab pelanggan 24/7, akurat, dalam Bahasa Indonesia.",
    url: "https://kundesk.vercel.app",
    type: "website",
  },
  twitter: {
    title: "Kundesk — AI Customer Service untuk Bisnis Indonesia",
    description:
      "Upload dokumen bisnis kamu — menu, FAQ, harga. Kundesk membangun chatbot AI yang menjawab pelanggan 24/7, akurat, dalam Bahasa Indonesia.",
  },
};

export default async function MarketingPage() {
  let activeOrgCount = 0;
  try {
    activeOrgCount = await getActiveOrgCount();
  } catch (err) {
    console.error("[marketing/page] Failed to fetch org count:", err);
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
      "Platform AI customer service untuk bisnis Indonesia. Upload dokumen, aktifkan chatbot, layani pelanggan 24/7.",
    inLanguage: "id",
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
      <LandingPage activeOrgCount={activeOrgCount} />
    </>
  );
}
