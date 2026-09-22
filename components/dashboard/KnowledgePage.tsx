"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DocumentsPage from "./DocumentsPage";
import { DocCountBadge } from "@/components/dashboard/badge";
import { fadeUp } from "@/lib/animations";

// Local to this page's tab state — not promoted to types/ since nothing
// outside this component reads it
type KnowledgeTab = "profil" | "dokumen";

interface KnowledgePageProps {
  isAdmin: boolean;
}

// Owns the shared page header + Profil/Dokumen tabs. Profil is the default
// tab (not Dokumen) — a form-based entry point reads friendlier to an owner
// who's never written a document before than landing on an upload zone.
const KnowledgePage = ({ isAdmin }: KnowledgePageProps) => {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("profil");

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center"
    >
      <div className="w-full max-w-4xl mx-auto">
        {/* Page header — shared across both tabs */}
        <div className="mb-6">
          <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
            Info Bisnis
          </h1>
          <p className="text-[13px] text-(--color-text-500) mt-1">
            Lengkapi profil bisnis dan dokumen kamu — KUN akan menjawab
            pelanggan berdasarkan ini.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as KnowledgeTab)}
        >
          <TabsList className="p-1.5 gap-1 rounded-[12px] bg-(--color-bg-page) border border-(--color-border)">
            <TabsTrigger
              value="profil"
              className="h-auto relative px-4 rounded-[9px] text-[13.5px] font-medium text-(--color-text-500) 
              transition-colors duration-200 data-[state=inactive]:hover:text-(--color-text-900) data-[state=active]:bg-transparent 
              data-[state=active]:text-(--color-brand) data-[state=active]:font-semibold data-[state=active]:shadow-none 
              dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent dark:text-(--color-text-500) 
              dark:data-[state=inactive]:hover:text-(--color-text-900)"
            >
              {activeTab === "profil" && (
                <motion.span
                  layoutId="knowledge-tab-pill"
                  className="absolute inset-0 rounded-[9px] bg-(--color-bg-card) shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}
              <span className="relative z-10">Profil</span>
            </TabsTrigger>

            <TabsTrigger
              value="dokumen"
              className="h-auto relative px-4 rounded-[9px] text-[13.5px] font-medium text-(--color-text-500) 
                transition-colors duration-200 data-[state=inactive]:hover:text-(--color-text-900) data-[state=active]:bg-transparent 
                data-[state=active]:text-(--color-brand) data-[state=active]:font-semibold data-[state=active]:shadow-none 
                dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent dark:text-(--color-text-500) 
                dark:data-[state=inactive]:hover:text-(--color-text-900)"
            >
              {activeTab === "dokumen" && (
                <motion.span
                  layoutId="knowledge-tab-pill"
                  className="absolute inset-0 rounded-[9px] bg-(--color-bg-card) shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                Dokumen
                <DocCountBadge />
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profil">
            {/* Placeholder — profile form is the next build step, not this one */}
            <div className="card-base overflow-hidden py-14 text-center">
              <div className="text-4xl mb-3">🏪</div>
              <div className="text-[14px] font-semibold text-(--color-text-500)">
                Profil bisnis akan segera hadir di sini
              </div>
              <div className="text-[12px] text-(--color-text-400) mt-1">
                Jam buka, kontak, dan metode pembayaran — sedang dibangun
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dokumen">
            <DocumentsPage isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default KnowledgePage;
