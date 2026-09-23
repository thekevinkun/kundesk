"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { EntryRow } from "@/components/dashboard/knowledge/sections";
import { SECTION_KIND_LABELS } from "./constants";
import type { KnowledgeEntryRow, KnowledgeSectionRow } from "@/types/knowledge";

interface SectionRowProps {
  section: KnowledgeSectionRow;
  isAdmin: boolean;
  entryLimitReached: boolean;
  onEditSection: () => void;
  onDeleteSection: () => void;
  onAddEntry: () => void;
  onEditEntry: (entry: KnowledgeEntryRow) => void;
  onDeleteEntry: (entry: KnowledgeEntryRow) => void;
  onRefresh: () => void;
}

const SectionRow = ({
  section,
  isAdmin,
  entryLimitReached,
  onEditSection,
  onDeleteSection,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onRefresh,
}: SectionRowProps) => {
  // Collapsed by default — a section can hold ~190 entries (Rumah Paco scale)
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card-base overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-(--color-bg-page) transition-colors"
      >
        <span className="badge-base badge-brand text-[10.5px] flex-shrink-0">
          {SECTION_KIND_LABELS[section.kind]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-(--color-text-900) truncate">
            {section.title}
          </div>
          {section.note && (
            <div className="text-[11.5px] text-(--color-text-400) truncate">
              {section.note}
            </div>
          )}
        </div>
        <span className="text-[11.5px] text-(--color-text-400) flex-shrink-0">
          {section.entries.length} entri
        </span>
        <span className="text-(--color-text-400) flex-shrink-0">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {isAdmin && (
        <div className="flex items-center gap-2 px-5 pb-3 -mt-1">
          <button
            onClick={onEditSection}
            className="text-[11.5px] text-(--color-text-400) hover:text-(--color-text-900) transition-colors"
          >
            Edit bagian
          </button>
          <span className="text-(--color-border)">·</span>
          <button
            onClick={onDeleteSection}
            className="text-[11.5px] text-(--color-text-400) hover:text-(--color-danger) transition-colors"
          >
            Hapus bagian
          </button>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-(--color-border-sm) overflow-hidden"
          >
            {section.entries.length === 0 ? (
              <div className="py-8 text-center text-[12.5px] text-(--color-text-400)">
                Belum ada entri di bagian ini.
              </div>
            ) : (
              section.entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  sectionKind={section.kind}
                  isAdmin={isAdmin}
                  onEdit={() => onEditEntry(entry)}
                  onDelete={() => onDeleteEntry(entry)}
                  onToggled={onRefresh}
                />
              ))
            )}

            {isAdmin && (
              <div className="px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onAddEntry}
                  disabled={entryLimitReached}
                  className="border-(--color-border) text-[12.5px]"
                >
                  + Tambah entri
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SectionRow;
