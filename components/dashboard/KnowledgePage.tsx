"use client";

import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fadeUp } from "@/lib/animations";
import DocumentsPage from "./DocumentsPage";

interface KnowledgePageProps {
  isAdmin: boolean;
}

// Owns the shared page header + Profil/Dokumen tabs. Profil is the default
// tab (not Dokumen) — a form-based entry point reads friendlier to an owner
// who's never written a document before than landing on an upload zone.
const KnowledgePage = ({ isAdmin }: KnowledgePageProps) => {
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

        <Tabs defaultValue="profil">
          <TabsList>
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="dokumen">Dokumen</TabsTrigger>
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
