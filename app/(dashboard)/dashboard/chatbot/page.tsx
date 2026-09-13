import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ChatbotConfigPage, AccessRestricted } from "@/components/dashboard";
import { getChatbotConfig } from "@/lib/actions/chatbot";

export const metadata: Metadata = {
  title: "Konfigurasi KUN",
};

export default async function ChatbotConfigRoute() {
  // Chatbot config is admin-only (Phase 16 decision) — check before fetching
  const { orgRole } = await auth();
  if (orgRole !== "org:admin") {
    return <AccessRestricted featureName="Konfigurasi KUN" />;
  }

  const config = await getChatbotConfig();

  // No chatbot found — shouldn't happen after Phase 4 auto-seed
  // Redirect to dashboard to avoid blank page
  if (!config) redirect("/dashboard");

  return <ChatbotConfigPage config={config} />;
}
