"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTION_KIND_OPTIONS } from "./constants";
import { createSection, updateSection } from "@/lib/actions/knowledge";
import type { KnowledgeSectionRow, SectionKind } from "@/types/knowledge";

interface SectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: KnowledgeSectionRow | null; // null = create, present = edit
  onSaved: () => void;
}

const SectionDialog = ({
  open,
  onOpenChange,
  section,
  onSaved,
}: SectionDialogProps) => {
  const [kind, setKind] = useState<SectionKind>("catalog");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setKind(section?.kind ?? "catalog");
    setTitle(section?.title ?? "");
    setNote(section?.note ?? "");
  }, [open, section]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Nama bagian wajib diisi");
      return;
    }

    startTransition(async () => {
      const payload = {
        kind,
        title: trimmedTitle,
        note: note.trim() || undefined,
      };

      const result = section
        ? await updateSection({ id: section.id, ...payload })
        : await createSection(payload);

      if (result.success) {
        toast.success(section ? "Bagian diperbarui" : "Bagian ditambahkan");
        onOpenChange(false);
        onSaved();
        return;
      }
      toast.error("Gagal menyimpan", { description: result.error });
    });
  };

  // My own guardrail, not a backend rule — see message above this code block
  const kindLocked = isPending || (!!section && section.entries.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{section ? "Edit bagian" : "Tambah bagian"}</DialogTitle>
          <DialogDescription>
            Sebuah bagian mengelompokkan entri sejenis — misalnya &quot;Menu
            Sarapan&quot; atau &quot;Pertanyaan Umum&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[12.5px] font-semibold text-(--color-text-700) mb-1.5 block">
              Jenis bagian
            </Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as SectionKind)}
              disabled={kindLocked}
            >
              <SelectTrigger className="input-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTION_KIND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {section && section.entries.length > 0 && (
              <p className="text-[11.5px] text-(--color-text-400) mt-1">
                Jenis tidak bisa diubah setelah ada entri di dalamnya.
              </p>
            )}
          </div>

          <div>
            <Label className="text-[12.5px] font-semibold text-(--color-text-700) mb-1.5 block">
              Nama bagian
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Menu Sarapan"
              maxLength={80}
              disabled={isPending}
              className="input-base"
              aria-label="Nama bagian"
            />
          </div>

          <div>
            <Label className="text-[12.5px] font-semibold text-(--color-text-700) mb-1.5 block">
              Catatan (opsional)
            </Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Tersedia 07.00 – 10.00"
              maxLength={300}
              disabled={isPending}
              className="input-base"
              aria-label="Catatan bagian"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="btn-brand"
            aria-busy={isPending}
          >
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SectionDialog;
