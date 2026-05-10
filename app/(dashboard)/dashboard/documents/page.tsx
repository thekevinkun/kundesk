import type { Metadata } from "next";
import { DocumentsPage } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Dokumen",
};

export default function DocumentsRoute() {
  return <DocumentsPage />;
}
