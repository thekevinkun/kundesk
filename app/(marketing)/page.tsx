import type { Metadata } from "next";
import { getActiveOrgCount } from "@/lib/db/queries/dashboard";
import { LandingPage } from "@/components/landing";

export const metadata: Metadata = {
  title: "AI Customer Service untuk Bisnis Indonesia",
};

export default async function MarketingPage() {
  // Real org count — fallback to 0 if DB is unreachable, page must never crash
  let activeOrgCount = 0;
  try {
    activeOrgCount = await getActiveOrgCount();
  } catch (err) {
    console.error("[marketing/page] Failed to fetch org count:", err);
  }

  return <LandingPage activeOrgCount={activeOrgCount} />;
}
