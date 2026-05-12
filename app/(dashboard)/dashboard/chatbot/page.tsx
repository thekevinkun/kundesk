import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatbotConfigPage } from "@/components/dashboard";
import { getChatbotConfig } from "@/lib/actions/chatbot";

export const metadata: Metadata = {
  title: "Konfigurasi Chatbot",
};

export default async function ChatbotConfigRoute() {
  const config = await getChatbotConfig();

  // No chatbot found — shouldn't happen after Phase 4 auto-seed
  // Redirect to dashboard to avoid blank page
  if (!config) redirect("/dashboard");

  return <ChatbotConfigPage config={config} />;
}
