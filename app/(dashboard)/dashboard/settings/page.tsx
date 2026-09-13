import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SettingsPage, AccessRestricted } from "@/components/dashboard";
import { getOrgSettings } from "@/lib/actions/settings";

export const metadata: Metadata = {
  title: "Pengaturan",
};

export default async function SettingsRoute() {
  // Settings is admin-only (Phase 16 decision) — check before fetching
  const { orgRole } = await auth();
  if (orgRole !== "org:admin") {
    return <AccessRestricted featureName="Pengaturan" />;
  }

  const settings = await getOrgSettings();

  // Org row missing — shouldn't happen, but safe fallback
  if (!settings) redirect("/dashboard");

  return <SettingsPage settings={settings} />;
}
