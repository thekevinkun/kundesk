import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { KnowledgePage } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Info Bisnis",
};

export default async function KnowledgeRoute() {
  // Page itself stays visible to org:member (Option B decision) — only
  // upload/delete (Dokumen tab) are gated. isAdmin controls whether those
  // controls render inside the tabs.
  const { orgRole } = await auth();
  const isAdmin = orgRole === "org:admin";

  return <KnowledgePage isAdmin={isAdmin} />;
}
