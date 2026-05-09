// Select Organization page — shown when authenticated user has no active org
// Clerk's CreateOrganization component handles the creation UI
// Once created: webhook fires → orgs table synced → redirect to dashboard

"use client";

import { CreateOrganization } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { fadeIn, fadeUp, scaleUp } from "@/lib/animations";

export default function SelectOrganizationPage() {
  return (
    // Full-screen centered layout with soft page background
    <motion.main
      className="min-h-screen bg-(--color-bg-page) flex items-center justify-center p-6"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
    >
      <div className="w-full max-w-md">
        {/* Logo + heading */}
        <motion.div
          className="text-center mb-8"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          {/* Kundesk logo — same pattern as sidebar: Kun in text-900, desk in brand */}
          <div className="text-3xl font-extrabold tracking-tight mb-3">
            <span className="text-(--color-text-900)">Kun</span>
            <span className="text-(--color-brand)">desk</span>
          </div>
          <h1 className="text-xl font-bold text-(--color-text-900) tracking-tight mb-2">
            Buat Organisasi Pertamamu
          </h1>
          <p className="text-sm text-(--color-text-500) leading-relaxed">
            Organisasi adalah ruang kerja bisnismu di Kundesk. <br />
            Semua dokumen dan chatbot tersimpan di sini.
          </p>
        </motion.div>

        {/* Clerk CreateOrganization component */}
        <motion.div
          variants={scaleUp}
          initial="hidden"
          animate="visible"
          className="flex justify-center"
        >
          <CreateOrganization
            // After org is created, Clerk redirects here
            // Webhook fires in background, org syncs to DB
            afterCreateOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                // Match our card style — white bg, rounded, shadow
                rootBox: "w-full",
                card: "shadow-md rounded-2xl border border-(--color-border) w-full",
                headerTitle: "font-bold tracking-tight",
                headerSubtitle: "text-(--color-text-500)",
                formButtonPrimary:
                  "bg-(--color-brand) hover:bg-(--color-brand-dark) text-white font-semibold rounded-full transition-all",
              },
            }}
          />
        </motion.div>
      </div>
    </motion.main>
  );
}
