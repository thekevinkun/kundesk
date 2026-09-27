"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DocumentsPage from "./DocumentsPage";
import { DocCountBadge } from "@/components/dashboard/badge";
import { ProfileForm } from "@/components/dashboard/knowledge";
import { fadeUp } from "@/lib/animations";
import type { PlanName } from "@/types/billing";
import type { CompileProfile, KnowledgeSectionRow } from "@/types/knowledge";

type KnowledgeTab = "dokumen" | "manual";

interface KnowledgePageProps {
  isAdmin: boolean;
  initialProfile: CompileProfile;
  initialSections: KnowledgeSectionRow[];
  plan: PlanName;
}

const KnowledgePage = ({
  isAdmin,
  initialProfile,
  initialSections,
  plan,
}: KnowledgePageProps) => {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("dokumen");

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center"
    >
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
            Info Bisnis
          </h1>
          <p className="text-[13px] text-(--color-text-500) mt-1">
            Ada dua cara mengisi pengetahuan KUN — unggah dokumen di tab{" "}
            <span className="font-medium text-(--color-text-700)">Dokumen</span>
            , atau isi form langsung di tab{" "}
            <span className="font-medium text-(--color-text-700)">
              Isi Manual
            </span>
            . Bisa pakai salah satu, atau keduanya sekaligus.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as KnowledgeTab)}
        >
          <TabsList className="p-1.5 gap-1 rounded-[12px] bg-(--color-bg-page) border border-(--color-border)">
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

            <TabsTrigger
              value="manual"
              className="h-auto relative px-4 rounded-[9px] text-[13.5px] font-medium text-(--color-text-500) 
              transition-colors duration-200 data-[state=inactive]:hover:text-(--color-text-900) data-[state=active]:bg-transparent 
              data-[state=active]:text-(--color-brand) data-[state=active]:font-semibold data-[state=active]:shadow-none 
              dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent dark:text-(--color-text-500) 
              dark:data-[state=inactive]:hover:text-(--color-text-900)"
            >
              {activeTab === "manual" && (
                <motion.span
                  layoutId="knowledge-tab-pill"
                  className="absolute inset-0 rounded-[9px] bg-(--color-bg-card) shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}
              <span className="relative z-10">Isi Manual</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dokumen">
            <DocumentsPage isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="manual">
            <ProfileForm
              isAdmin={isAdmin}
              initialProfile={initialProfile}
              initialSections={initialSections}
              plan={plan}
            />
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default KnowledgePage;
