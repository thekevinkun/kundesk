import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsPage } from "@/components/dashboard";
import { getOrgSettings } from "@/lib/actions/settings";

export const metadata: Metadata = {
  title: "Pengaturan",
};

export default async function SettingsRoute() {
  const settings = await getOrgSettings();

  // Org row missing — shouldn't happen, but safe fallback
  if (!settings) redirect("/dashboard");

  return <SettingsPage settings={settings} />;
}
