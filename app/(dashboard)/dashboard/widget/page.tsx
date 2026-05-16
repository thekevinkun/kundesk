import type { Metadata } from "next";
import { WidgetPage } from "@/components/dashboard";
import { getWidgetData } from "@/lib/actions/chatbot";

export const metadata: Metadata = {
  title: "Widget & Embed",
};

export default async function WidgetRoute() {
  const data = await getWidgetData();

  return <WidgetPage data={data} />;
}
