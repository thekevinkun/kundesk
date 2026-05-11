import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ChatPage } from "@/components/chat";
import { db } from "@/lib/db";
import { orgs, chatbots } from "@/lib/db/schema";
import type { ChatbotConfig } from "@/types/chat";

// Route params are async in Next.js 16
type Props = {
  params: Promise<{ orgSlug: string }>;
};

// Dynamic metadata — page title uses the business's chatbot name
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgSlug } = await params;

  const [org] = await db
    .select({ name: orgs.name })
    .from(orgs)
    .where(eq(orgs.slug, orgSlug))
    .limit(1);

  return {
    title: org ? `${org.name} - Customer Service` : "Chat",
  };
}

export default async function ChatRoute({ params }: Props) {
  const { orgSlug } = await params;

  // Fetch org — same 404 response whether missing or inactive (no enumeration)
  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.slug, orgSlug))
    .limit(1);

  if (!org) notFound();

  // Fetch active chatbot for this org
  const [chatbot] = await db
    .select()
    .from(chatbots)
    .where(and(eq(chatbots.orgId, org.id), eq(chatbots.isActive, true)))
    .limit(1);

  // No active chatbot — same notFound, no enumeration
  if (!chatbot) notFound();

  const config: ChatbotConfig = {
    name: chatbot.name,
    tone: chatbot.tone as ChatbotConfig["tone"],
    language: chatbot.language as ChatbotConfig["language"],
    accentColor: chatbot.accentColor,
    greetingMessage: chatbot.greetingMessage,
    systemPrompt: chatbot.systemPrompt,
  };

  return <ChatPage config={config} orgSlug={orgSlug} orgName={org.name} />;
}
