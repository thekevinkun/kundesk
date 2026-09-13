import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { DocumentsPage } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Dokumen",
};

export default async function DocumentsRoute() {
  // Documents page itself stays visible to org:member (Option B decision) —
  // only upload/delete are gated. isAdmin controls whether those controls render.
  const { orgRole } = await auth();
  const isAdmin = orgRole === "org:admin";

  return <DocumentsPage isAdmin={isAdmin} />;
}
