"use client";

import { useCallback, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EntryDialog,
  SectionRow,
  SectionDialog,
  RemoveEntryDialog,
  RemoveSectionDialog,
} from "@/components/dashboard/knowledge/sections";
import { listKnowledgeSections } from "@/lib/actions/knowledge";
import { PLAN_LIMITS } from "@/types/billing";
import { MAX_KNOWLEDGE_SECTIONS } from "@/types/knowledge";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { PlanName } from "@/types/billing";
import type {
  KnowledgeEntryRow,
  KnowledgeSectionRow,
  SectionKind,
} from "@/types/knowledge";

interface KnowledgeSectionsPanelProps {
  isAdmin: boolean;
  initialSections: KnowledgeSectionRow[];
  plan: PlanName;
}

const KnowledgeSectionsPanel = ({
  isAdmin,
  initialSections,
  plan,
}: KnowledgeSectionsPanelProps) => {
  const [sections, setSections] = useState(initialSections);
  const [, startRefresh] = useTransition();

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionDialogTarget, setSectionDialogTarget] =
    useState<KnowledgeSectionRow | null>(null);
  const [removeSectionTarget, setRemoveSectionTarget] =
    useState<KnowledgeSectionRow | null>(null);
  const [entryDialogTarget, setEntryDialogTarget] = useState<{
    sectionId: number;
    sectionKind: SectionKind;
    entry: KnowledgeEntryRow | null;
  } | null>(null);
  const [removeEntryTarget, setRemoveEntryTarget] =
    useState<KnowledgeEntryRow | null>(null);

  // Full refetch after any mutation — same pattern as TeamPage.refreshMembers
  const refresh = useCallback(() => {
    startRefresh(async () => {
      const result = await listKnowledgeSections();
      if (result.success) {
        setSections(result.data);
      } else {
        toast.error("Gagal memuat ulang", { description: result.error });
      }
    });
  }, []);

  const totalEntries = sections.reduce((sum, s) => sum + s.entries.length, 0);
  const entryLimit = PLAN_LIMITS[plan].knowledgeEntries;
  const entryLimitReached = totalEntries >= entryLimit;
  const sectionLimitReached = sections.length >= MAX_KNOWLEDGE_SECTIONS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-(--color-text-400)">
          {totalEntries} / {entryLimit} entri · {sections.length} bagian
        </p>
        {isAdmin && (
          <Button
            type="button"
            onClick={() => {
              setSectionDialogTarget(null);
              setSectionDialogOpen(true);
            }}
            disabled={sectionLimitReached}
            className="btn-brand text-[12.5px]"
          >
            + Tambah bagian
          </Button>
        )}
      </div>

      {isAdmin && entryLimitReached && (
        <div className="px-4 py-3 rounded-(--radius-sm) bg-(--color-brand-light) border border-(--color-brand-mid) text-[12.5px] text-(--color-brand-dark)">
          Batas entri tercapai. Upgrade plan untuk menambah lebih banyak.
        </div>
      )}

      {sections.length === 0 ? (
        <div className="card-base py-14 text-center">
          <div className="text-4xl mb-3">🗂️</div>
          <div className="text-[14px] font-semibold text-(--color-text-500)">
            Belum ada bagian
          </div>
          <div className="text-[12px] text-(--color-text-400) mt-1">
            {isAdmin
              ? "Tambah bagian pertama — misalnya menu, FAQ, atau kebijakan"
              : "Hubungi admin untuk menambahkan info"}
          </div>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {sections.map((section) => (
            <motion.div key={section.id} variants={staggerItem}>
              <SectionRow
                section={section}
                isAdmin={isAdmin}
                entryLimitReached={entryLimitReached}
                onEditSection={() => {
                  setSectionDialogTarget(section);
                  setSectionDialogOpen(true);
                }}
                onDeleteSection={() => setRemoveSectionTarget(section)}
                onAddEntry={() =>
                  setEntryDialogTarget({
                    sectionId: section.id,
                    sectionKind: section.kind,
                    entry: null,
                  })
                }
                onEditEntry={(entry) =>
                  setEntryDialogTarget({
                    sectionId: section.id,
                    sectionKind: section.kind,
                    entry,
                  })
                }
                onDeleteEntry={setRemoveEntryTarget}
                onRefresh={refresh}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <SectionDialog
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
        section={sectionDialogTarget}
        onSaved={refresh}
      />

      <RemoveSectionDialog
        open={!!removeSectionTarget}
        onOpenChange={(open) => !open && setRemoveSectionTarget(null)}
        section={removeSectionTarget}
        onRemoved={refresh}
      />

      {entryDialogTarget && (
        <EntryDialog
          open={!!entryDialogTarget}
          onOpenChange={(open) => !open && setEntryDialogTarget(null)}
          sectionId={entryDialogTarget.sectionId}
          sectionKind={entryDialogTarget.sectionKind}
          entry={entryDialogTarget.entry}
          onSaved={refresh}
        />
      )}

      <RemoveEntryDialog
        open={!!removeEntryTarget}
        onOpenChange={(open) => !open && setRemoveEntryTarget(null)}
        entry={removeEntryTarget}
        onRemoved={refresh}
      />
    </div>
  );
};

export default KnowledgeSectionsPanel;
